# Balena Logs Extractor

A Node.js tool to extract logs from Balena devices using SSH tunneling.

## Why This Project?

Balena is an excellent platform for IoT device management, offering robust features for deployment and monitoring. However, debugging in production can be challenging, especially when dealing with multiple devices. While Balena provides persistent logging options, which are crucial for production environments, manually collecting and analyzing logs from each device can be time-consuming and frustrating.

This project aims to simplify the log collection process by:
- Automating the log extraction from multiple devices
- Providing a simple command-line interface
- Making it easy to collect and analyze logs when needed
- Saving time and reducing the manual effort required for debugging

## Customization

Feel free to fork this project and modify it to suit your specific needs. For example:
- If you're working with devices on limited data plans, you can modify the script to process logs directly on the device instead of downloading them
- You can add custom log filtering or processing logic
- Implement specific error pattern detection
- Add support for different log formats or sources

The current implementation downloads the logs as a compressed file, but you can easily modify the SSH command in `extractBalenaLogs()` to process the logs directly on the device if that better suits your use case.

## Prerequisites

- Node.js installed
- Balena CLI installed
- Access to Balena Cloud account
- SSH key for device access

## Setup

### 1. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
LOGIN_TOKEN_BALENA=your_balena_token
SSH_PRIVATE_KEY=your_ssh_private_key
```

### 2. Getting Balena Token

1. Log in to [Balena Cloud](https://dashboard.balena-cloud.com)
2. Go to Preferences > Access Tokens
3. Click "Add Token"
4. Give it a name (e.g., "Logs Extractor")
5. Copy the generated token and add it to your `.env` file

### 3. Setting up SSH Key

#### Option 1: Using Balena's GitHub Instructions

1. Visit [Balena's SSH Access Documentation](https://www.balena.io/docs/learn/manage/ssh-access/)
2. Follow the instructions to generate and add your SSH key to your Balena account
3. Copy your private key and add it to the `.env` file

#### Option 2: Manual SSH Setup

1. Generate an SSH key if you don't have one:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. Add the key to your Balena account:
   ```bash
   balena keys add "My Key" ~/.ssh/id_ed25519.pub
   ```

3. Configure SSH:
   ```bash
   # Create .ssh directory if it doesn't exist
   mkdir -p ~/.ssh
   
   # Set correct permissions
   chmod 755 ~/.ssh
   
   # Create or update config file
   echo "Host github.com
     AddKeysToAgent yes
     IdentityFile ~/.ssh/balena-logs" > ~/.ssh/config
   
   # Set correct permissions for config
   chmod 644 ~/.ssh/config
   
   # Start SSH agent
   eval "$(ssh-agent -s)"
   
   # Add key to SSH agent
   ssh-add --apple-use-keychain ~/.ssh/balena-logs
   ```

## Usage

Run the script with a device UUID:

```bash
node src/app.js <device-uuid>
```

The script will:
1. Log in to Balena using your token
2. Establish an SSH tunnel to the device
3. Collect the logs
4. Output a URL where you can download the logs

## How it Works

1. The script first authenticates with Balena using your token
2. It then establishes an SSH tunnel to the specified device
3. Once the tunnel is established, it uses SSH to:
   - Navigate to the journal logs directory
   - Collect the logs
   - Compress them into a tar.gz file
   - Upload them to a temporary storage
   - Return a download URL

## Troubleshooting

If you encounter issues:

1. Check your Balena token is valid
2. Verify your SSH key is properly configured
3. Ensure you have the correct device UUID
4. Check the device is online and accessible

## License

