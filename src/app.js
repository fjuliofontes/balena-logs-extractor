// imports
const { spawn, exec, execSync } = require('child_process');
const fs = require("fs")

// Load env variables from .env file
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// Verify if we have the required tokens
if (
    process.env.LOGIN_TOKEN_BALENA == null ||
    process.env.SSH_PRIVATE_KEY == null ||
    process.env.BALENA_USERNAME == null
) {
    console.log("Missing tokens! Please fix!");
    return;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function execShellCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

function configureSSHKey() {
    const sshKey = process.env.SSH_PRIVATE_KEY;
    const sshDir = '~/.ssh';
    const configPath = `${sshDir}/config`;
    const sshKeyPath = `${sshDir}/balena-logs`;

    // Create .ssh directory if it doesn't exist
    if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true });
    }

    // Create config file if it doesn't exist
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, 'Host github.com\n  AddKeysToAgent yes\n  IdentityFile ' + sshKeyPath);
    }

    // Set correct permissions for .ssh directory and config
    fs.chmodSync(sshDir, 0o755);
    fs.chmodSync(configPath, 0o644);

    // Write SSH private key
    fs.writeFileSync(sshKeyPath, sshKey);
    fs.chmodSync(sshKeyPath, 0o600);

    // Start SSH agent and add key
    execSync('eval "$(ssh-agent -s)"');
    execSync(`ssh-add --apple-use-keychain ${sshKeyPath}`);
}

// Function to get balena logs!
async function extractBalenaLogs(uuid) {
    if (!uuid) {
        console.error('Error: UUID is required. Usage: node app.js <uuid>');
        process.exit(1);
    }

    let tunnel;
    try {
        const out = fs.openSync("./tunnel-stdout.log", "w");
        const err = fs.openSync("./tunnel-stderr.log", "w");
        tunnel = spawn(
            "balena",
            ["device", "tunnel", uuid, "-p", "22222:4321"],
            {
                shell: false,
                detached: true,
                stdio: [process.stdin, out, err],
            }
        );

        tunnel.unref();

        // Handle tunnel process events
        tunnel.on('error', (err) => {
            console.error('Tunnel process error:', err);
            cleanupAndExit(1);
        });

        // wait up to 30 sec for the tunnel to start
        let retry = 0;
        do {
            await delay(1000);
            if (fs.readFileSync("./tunnel-stdout.log", 'utf-8').includes("Waiting for connections")) {
                break;
            }
        } while (retry++ < 30);

        if (retry >= 30) {
            console.log("Impossible to establish a tunnel!");
            cleanupAndExit(1);
        }

        // delete old ssh credentials
        await execShellCommand(
            'ssh-keygen -f ~/.ssh/known_hosts -R "[localhost]:4321"'
        );

        const SSHResult = await execShellCommand(
            `ssh -i ~/.ssh/balena-logs -o StrictHostKeyChecking=no -p 4321 ${process.env.BALENA_USERNAME}@localhost "cd /var/log/journal && dir=\\$(ls -d */ | head -n1) && journalctl --directory=\\\"/var/log/journal/\\$dir\\\" > merged_log.txt && tar czf logs.tar.gz merged_log.txt && url=\\$(curl uploader.sh -T logs.tar.gz) && echo \\\"\\$url\\\" && exit"`
        );

        // Extract wget URL using regex
        const wgetUrlMatch = SSHResult.match(/wget (http:\/\/[^\s]+)/);
        const wgetUrl = wgetUrlMatch ? wgetUrlMatch[1] : null;

        console.log(wgetUrl || 'No URL found');

        // Clean up and exit
        cleanupAndExit(0);

    } catch (error) {
        console.error(error);
        cleanupAndExit(1);
    }

    function cleanupAndExit(exitCode) {
        if (tunnel) {
            try {
                process.kill(-tunnel.pid, 'SIGTERM');
            } catch (e) {
                if (e.code !== 'ESRCH') {
                    console.warn('Failed to kill tunnel processes:', e);
                }
            }
        }

        // Clean up log files
        try {
            if (fs.existsSync("./tunnel-stdout.log")) {
                fs.unlinkSync("./tunnel-stdout.log");
            }
            if (fs.existsSync("./tunnel-stderr.log")) {
                fs.unlinkSync("./tunnel-stderr.log");
            }
        } catch (e) {
            console.warn('Failed to clean up log files:', e);
        }

        // Force exit after a short delay to ensure cleanup
        setTimeout(() => {
            process.exit(exitCode);
        }, 1000);
    }
}

async function balenaLogin() {
    const loginResult = await execShellCommand(`balena login --token ${process.env.LOGIN_TOKEN_BALENA}`);
    const loginStatusMatch = loginResult.match(/Successfully logged in/);
    if (!loginStatusMatch) {
        console.error('Failed to login to balena');
        process.exit(1);
    }
}

async function setupAndCollectLogs(uuid) {
    // configureSSHKey();
    await balenaLogin();
    await extractBalenaLogs(uuid);
}

// Get UUID from command line arguments
const uuid = process.argv[2];
setupAndCollectLogs(uuid);