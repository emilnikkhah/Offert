# Offert

Offertprogram

## Table of Contents

1.  [Local Development Setup](#how-to-run-this-application)
2.  [Deploying to DigitalOcean](#deploying-to-digitalocean)
    *   [Prerequisites for Deployment](#prerequisites-for-deployment)
    *   [Step 1: Generate SSH Keys](#step-1-generate-ssh-keys)
    *   [Step 2: Add SSH Public Key to DigitalOcean](#step-2-add-ssh-public-key-to-digitalocean)
    *   [Step 3: Add SSH Public Key to GitHub](#step-3-add-ssh-public-key-to-github-for-repository-access)
    *   [Step 4: Create and Configure DigitalOcean Droplet](#step-4-create-and-configure-digitalocean-droplet)
    *   [Step 5: Connect to Your Droplet](#step-5-connect-to-your-droplet)
    *   [Step 6: Install Server Dependencies (Git, NVM, Node.js)](#step-6-install-server-dependencies)
    *   [Step 7: Clone Your Application from GitHub](#step-7-clone-your-application-from-github)
    *   [Step 8: Install Application Dependencies](#step-8-install-application-dependencies)
    *   [Step 9: Running the Application on the Server](#step-9-running-the-application-on-the-server)
    *   [Step 10: Keeping the Application Running (PM2)](#step-10-keeping-the-application-running-pm2)
3.  [Troubleshooting](#troubleshooting)

## How to Run This Application (Local Development)

**Prerequisites:**

*   Node.js and npm (Node Package Manager) must be installed on your system.

**Steps:**

1.  **Clone the Repository (if you haven't already):**
    If you're obtaining the code from a Git repository, clone it and navigate into the project directory:
    ```shell
    git clone <your-repository-url> # Replace <your-repository-url> with your actual Git repo URL
    cd Offert
    ```
    If you have the files locally, just navigate to the `Offert` directory.

2.  **Install Dependencies:**
    Open your terminal in the `Offert` project directory and run the following command to install the project's dependencies listed in `package.json`:
    ```shell
    npm install
    ```

3.  **Run the Application:**
    You have two primary ways to start the application:

    *   **Production Mode:**
        To run the application as it would normally be run:
        ```shell
        npm start
        ```

    *   **Development Mode:**
        To run the application with `nodemon`, which automatically restarts the server when file changes are detected (useful for development):
        ```shell
        npm run dev
        ```

After running the start command, the application should be accessible via a web browser, typically at an address like `http://localhost:PORT` (the exact port will be specified in the application's console output or its configuration, often in `app.js`).

## Deploying to DigitalOcean

This section guides you through deploying the Offert application to a DigitalOcean Ubuntu droplet.

### Prerequisites for Deployment

*   A DigitalOcean account.
*   A domain name (optional, but recommended for production).
*   Your application code hosted on GitHub (or another Git provider).

### Step 1: Generate SSH Keys

SSH keys provide a secure way to log into your server without a password and to securely connect to GitHub. If you don't already have SSH keys, generate them on your **local machine**:

1.  Open your terminal.
2.  Run the following command:
    ```shell
    ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
    ```
    Replace `"your_email@example.com"` with your actual email address.
3.  Press Enter to accept the default file location (`~/.ssh/id_rsa`).
4.  Enter a strong passphrase when prompted, or press Enter for no passphrase (less secure, but can be convenient). This passphrase is for your private key, not your server or GitHub password.

This will create two files:
*   `~/.ssh/id_rsa` (your **private** key - keep this secret and secure!)
*   `~/.ssh/id_rsa.pub` (your **public** key - this is what you'll share)

### Step 2: Add SSH Public Key to DigitalOcean

When creating a new Droplet on DigitalOcean, or by going to `Account -> Security -> SSH keys`, you can add your SSH public key.

1.  Copy your SSH public key to your clipboard. On macOS or Linux:
    ```shell
    pbcopy < ~/.ssh/id_rsa.pub # macOS
    # or
    cat ~/.ssh/id_rsa.pub # Linux (then manually copy the output)
    ```
    On Windows (if using Git Bash):
    ```shell
    cat ~/.ssh/id_rsa.pub
    ```
2.  In your DigitalOcean account, navigate to the "Security" section (usually under "Account" or "Settings").
3.  Find "SSH Keys" and click "Add SSH Key".
4.  Paste your public key into the "SSH key content" field.
5.  Give it a recognizable name (e.g., "My Laptop Key").
6.  Click "Add SSH Key".

Now, when you create new Droplets, you can select this key to be automatically added, allowing passwordless SSH access.

### Step 3: Add SSH Public Key to GitHub (for Repository Access)

To allow your DigitalOcean droplet to securely clone your private repository from GitHub (or for you to push/pull from your local machine without passwords):

1.  Copy your SSH public key to your clipboard again (if it's not still there):
    ```shell
    pbcopy < ~/.ssh/id_rsa.pub # macOS
    # or
    cat ~/.ssh/id_rsa.pub # Linux (then manually copy the output)
    ```
2.  Go to your GitHub account.
3.  Click on your profile picture in the top-right corner, then go to "Settings".
4.  In the user settings sidebar, click "SSH and GPG keys".
5.  Click "New SSH key" or "Add SSH key".
6.  Give it a title (e.g., "My DigitalOcean Droplet" if generating a key on the server, or "My Local Machine" if using your local key for GitHub).
7.  Paste your **public key** (`id_rsa.pub` contents) into the "Key" field.
8.  Click "Add SSH key".

### Step 4: Create and Configure DigitalOcean Droplet

1.  Log in to your DigitalOcean account.
2.  Click "Create" and then "Droplets".
3.  **Choose an image:** Select "Ubuntu" (e.g., the latest LTS version).
4.  **Choose a plan:** Select the plan that fits your needs (e.g., a basic shared CPU plan is often enough for small Node.js apps).
5.  **Choose a datacenter region:** Pick a region geographically close to your users.
6.  **Authentication:** Select "SSH keys" and choose the SSH key you added in Step 2. This is crucial for secure access.
7.  **Finalize and create:** Choose a hostname for your Droplet (e.g., `offert-app-server`). Click "Create Droplet".

Wait for the Droplet to be created. You'll get an IP address for your new server.

### Step 5: Connect to Your Droplet

Once your Droplet is active and you have its IP address:

1.  Open your terminal on your local machine.
2.  Connect to the Droplet using SSH. If you added your SSH key during Droplet creation, you'll typically connect as the `root` user initially (or a user specified by DigitalOcean if using a pre-configured image, though `root` is common for new Ubuntu droplets):
    ```shell
    ssh root@YOUR_DROPLET_IP_ADDRESS
    ```
    Replace `YOUR_DROPLET_IP_ADDRESS` with the actual IP of your Droplet.
3.  If this is your first time connecting, you'll be asked to verify the server's authenticity. Type `yes`.

**(Recommended Security Practice: Create a non-root user for daily operations after initial setup. For simplicity, this guide will proceed with `root` for initial setup, but research "DigitalOcean initial server setup" for best practices.)**

### Step 6: Install Server Dependencies

Once connected to your Droplet:

1.  **Update Package Lists:**
    ```shell
    apt update
    apt upgrade -y
    ```

2.  **Install Git:**
    ```shell
    apt install git -y
    ```

3.  **Install nvm (Node Version Manager):**
    Refer to the official nvm GitHub repository for the latest install command (it changes occasionally). Generally, it's:
    ```shell
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
    *(Check [https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm) for the latest version)*

    After installation, source your shell profile or log out and log back in:
    ```shell
    source ~/.bashrc # Or ~/.zshrc if you switched shells
    ```
    Verify installation:
    ```shell
    nvm --version
    ```

4.  **Install Node.js (e.g., version 18.17.0 as per previous discussions):**
    Consult your `package.json` for the `engines` field or choose a current LTS version.
    ```shell
    nvm install 18.17.0
    nvm use 18.17.0
    nvm alias default 18.17.0 # Make this the default for new sessions
    ```
    Verify:
    ```shell
    node -v
    npm -v
    ```

### Step 7: Clone Your Application from GitHub

1.  Create a directory for your application (e.g., `/var/www/offert` or `~/Offert` for the root user):
    ```shell
    mkdir -p ~/Offert # Creates the Offert directory in the root user's home
    cd ~/Offert
    ```
    Alternatively, for a more standard location (requires adjusting permissions or using `sudo`):
    ```shell
    # mkdir -p /var/www/offert
    # chown -R $(whoami):$(whoami) /var/www/offert # Give your user ownership
    # cd /var/www/offert
    ```

2.  Clone your repository from GitHub using the SSH link (not HTTPS):
    Go to your GitHub repository page, click the "Code" button, and select "SSH". Copy the URL.
    ```shell
    git clone git@github.com:YOUR_USERNAME/YOUR_REPOSITORY_NAME.git .
    # Example: git clone git@github.com:emilnikkhah/OffertAaBbCc.git .
    # The '.' at the end clones into the current directory
    ```
    If this is the first time the server connects to GitHub, you might be asked to verify GitHub's authenticity. Type `yes`.

### Step 8: Install Application Dependencies

Navigate into your application's directory (if you cloned into a subdirectory, `cd YOUR_REPOSITORY_NAME` first). If you cloned with `.` at the end, you are already in the correct directory.

```shell
cd ~/Offert # Or the directory you cloned into
npm install
```
This will install the dependencies listed in your `package.json`, including `sqlite3`, compiling them for the server's environment.

### Step 9: Running the Application on the Server

You can now start your application just like you would locally:

```shell
npm start
```
Or for development mode (less common for live servers):
```shell
npm run dev
```

Your application should now be running on your DigitalOcean Droplet. You can test it by navigating to `http://YOUR_DROPLET_IP_ADDRESS:PORT` in your web browser (where `PORT` is the port your Node.js app listens on, typically 3000 or defined in `app.js`).

**Note on Firewalls:** DigitalOcean Droplets often have `ufw` (Uncomplicated Firewall) enabled. You might need to allow traffic to your application's port:
```shell
ufw allow <PORT>/tcp # e.g., ufw allow 3000/tcp
ufw enable # If not already enabled
ufw status # To check
```

### Step 10: Keeping the Application Running (PM2)

If you close your SSH session, the `npm start` process will stop. To keep your Node.js application running in the background and automatically restart it if it crashes, use a process manager like PM2.

1.  **Install PM2 globally:**
    ```shell
    npm install pm2 -g
    ```

2.  **Start your application with PM2:**
    Navigate to your application directory (`~/Offert`).
    ```shell
    pm2 start app.js --name offert-app # Or use your main script file and desired app name
    ```
    If your start script is `npm start`, you can do:
    ```shell
    pm2 start npm --name offert-app -- run start
    ```

3.  **Check PM2 status:**
    ```shell
    pm2 list
    pm2 logs offert-app # To see logs
    ```

4.  **Enable PM2 to start on system reboot:**
    ```shell
    pm2 startup systemd # Or the appropriate command for your system if not systemd
    ```
    PM2 will output a command you need to run with `sudo` to complete this.

5.  **Save current PM2 process list:**
    ```shell
    pm2 save
    ```

Now your application will run continuously and restart on server reboots.

## Troubleshooting

### `invalid ELF header` error (especially with `sqlite3`)

If you encounter an error message similar to `Error: /path/to/node_modules/sqlite3/build/Release/node_sqlite3.node: invalid ELF header` when running `npm start` or `npm run dev`, it typically means that the native Node.js addons (like `sqlite3`) were compiled for a different system architecture or Node.js version.

This often occurs if:
*   You copied the `node_modules` folder from a different operating system (e.g., from macOS/Windows to Linux).
*   You changed your Node.js version after initially installing the dependencies on the server.

**Solution:**

1.  **Navigate to your project directory on the server:**
    ```shell
    cd ~/Offert # Or your project's path
    ```

2.  **Remove the existing `node_modules` directory and `package-lock.json`:**
    This forces a clean reinstallation and recompilation of all dependencies.
    ```shell
    rm -rf node_modules
    rm -f package-lock.json
    ```

3.  **Reinstall dependencies:**
    This will download and compile native addons like `sqlite3` for your current server environment.
    ```shell
    npm install
    ```

4.  **Try starting your application again (or restarting with PM2):**
    ```shell
    npm start
    # Or if using PM2:
    # pm2 restart offert-app
    ```
