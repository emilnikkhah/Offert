# Deploying the Dockerized Offert Application to DigitalOcean

This guide provides step-by-step instructions to build a Docker image for the Offert application, push it to a container registry (like Docker Hub), and deploy it on a DigitalOcean Droplet.

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Building the Docker Image](#step-1-building-the-docker-image)
3.  [Testing the Docker Image Locally](#step-2-testing-the-docker-image-locally)
4.  [Pushing the Docker Image to a Container Registry](#step-3-pushing-the-docker-image-to-a-container-registry)
5.  [Setting up a DigitalOcean Droplet with Docker](#step-4-setting-up-a-digitalocean-droplet-with-docker)
6.  [Deploying and Running the Container on DigitalOcean](#step-5-deploying-and-running-the-container-on-digitalocean)
7.  [Accessing Your Application](#step-6-accessing-your-application)
8.  [Managing the Container](#step-7-managing-the-container)
9.  [Updating the Application](#step-8-updating-the-application)
10. [Important Notes and Best Practices](#step-9-important-notes-and-best-practices)

## Prerequisites

*   **Docker Desktop:** Installed on your local machine. ([Download Docker Desktop](https://www.docker.com/products/docker-desktop))
*   **DigitalOcean Account:** To create and manage Droplets. ([Sign up for DigitalOcean](https://www.digitalocean.com/))
*   **Docker Hub Account (or other container registry):** To store your Docker images. ([Sign up for Docker Hub](https://hub.docker.com/))
*   **SSH Key:** Ensure your SSH public key is added to your DigitalOcean account for secure Droplet access.
*   **Application Code:** You have the Offert application code with the `Dockerfile` and `.dockerignore` files already created.

## Step 1: Building the Docker Image

Navigate to the root directory of your Offert application (where the `Dockerfile` is located) in your terminal and run the build command:

```shell
docker build -t YOUR_DOCKERHUB_USERNAME/offert-app:latest .
```

*   Replace `YOUR_DOCKERHUB_USERNAME` with your actual Docker Hub username.
*   `offert-app` is the suggested image name; you can change it if you like.
*   `:latest` is a tag for the image version. You can use specific version tags like `:1.0.0`.
*   The `.` at the end specifies that the build context (the files Docker can access) is the current directory.

This command will read the `Dockerfile`, download the base image, install dependencies, and copy your application code into the image.

## Step 2: Testing the Docker Image Locally

Before pushing to a registry, it's good practice to test if the image runs correctly on your local machine.

```shell
docker run --rm -p 3000:3000 \
    -v "$(pwd)/db_local_test:/usr/src/app/db" \
    -e SESSION_SECRET="a_very_strong_and_random_secret_for_testing" \
    -e NODE_ENV="development" \
    YOUR_DOCKERHUB_USERNAME/offert-app:latest
```

**Explanation:**
*   `docker run`: Command to run a container.
*   `--rm`: Automatically removes the container when it exits (useful for testing).
*   `-p 3000:3000`: Maps port 3000 on your host machine to port 3000 in the container (where the app listens).
*   `-v "$(pwd)/db_local_test:/usr/src/app/db"`: **Crucial for the SQLite database.** This mounts a directory named `db_local_test` from your current local directory into the `/usr/src/app/db` directory inside the container. This way, the SQLite database file will be stored on your host machine, and data will persist even if the container is stopped and restarted. Create the `db_local_test` directory locally if it doesn't exist (`mkdir db_local_test`).
*   `-e SESSION_SECRET="a_very_strong_and_random_secret_for_testing"`: Sets the required `SESSION_SECRET` environment variable. **For actual deployment, use a much stronger, unique secret.**
*   `-e NODE_ENV="development"`: For local testing, you might want to run in development mode (optional, the image defaults to `production` as per `Dockerfile`).
*   `YOUR_DOCKERHUB_USERNAME/offert-app:latest`: The image to run.

Open your browser and go to `http://localhost:3000`. You should see your application running. The SQLite database file (`offert_db.sqlite`) will be created inside the `db_local_test` folder on your local machine.

Press `Ctrl+C` in the terminal to stop the container.

## Step 3: Pushing the Docker Image to a Container Registry

Once you've confirmed the image works, push it to Docker Hub (or your chosen registry).

1.  **Log in to Docker Hub (or your registry):**
    ```shell
    docker login
    ```
    Enter your Docker Hub username and password when prompted.

2.  **Push the image:**
    ```shell
    docker push YOUR_DOCKERHUB_USERNAME/offert-app:latest
    ```
    If you used a different tag, replace `:latest` accordingly.

## Step 4: Setting up a DigitalOcean Droplet with Docker

1.  **Create a Droplet:**
    *   Log in to your DigitalOcean account.
    *   Click "Create" -> "Droplets".
    *   **Choose an image:** Under "Marketplace", search for "Docker" and select the "Docker on Ubuntu" image (e.g., the latest Docker CE version on the latest Ubuntu LTS). This comes with Docker pre-installed and configured.
    *   **Choose a plan:** Select a plan based on your application's needs.
    *   **Choose a datacenter region.**
    *   **Authentication:** Select "SSH keys" and choose your pre-added SSH key.
    *   **Finalize and create:** Choose a hostname and click "Create Droplet".

2.  **Connect to your Droplet via SSH:**
    Once the Droplet is created, copy its IP address.
    ```shell
    ssh root@YOUR_DROPLET_IP_ADDRESS
    ```

## Step 5: Deploying and Running the Container on DigitalOcean

Once connected to your Droplet via SSH:

1.  **Pull the Docker Image from the Registry:**
    ```shell
    docker pull YOUR_DOCKERHUB_USERNAME/offert-app:latest
    ```

2.  **Create a Directory for Persistent Database Storage:**
    The SQLite database file needs to be stored on the Droplet's filesystem, not inside the container, so data persists across container restarts and updates.
    ```shell
    mkdir -p /var/offert_data/db
    ```
    You can choose a different path if you prefer.

3.  **Run the Docker Container:**
    ```shell
    docker run -d -p 80:3000 --restart always \
        -v /var/offert_data/db:/usr/src/app/db \
        -e SESSION_SECRET="YOUR_ACTUAL_VERY_STRONG_AND_UNIQUE_SECRET" \
        -e PORT="3000" \
        --name offert-container \
        YOUR_DOCKERHUB_USERNAME/offert-app:latest
    ```

    **Explanation of options:**
    *   `-d`: Runs the container in detached mode (in the background).
    *   `-p 80:3000`: Maps port 80 on the Droplet to port 3000 in the container. This means users can access your app via `http://YOUR_DROPLET_IP_ADDRESS` without specifying a port. If you prefer to use a different port or a reverse proxy like Nginx, adjust accordingly (e.g., `-p 3000:3000` and set up Nginx to proxy to port 3000).
    *   `--restart always`: Configures the container to automatically restart if it stops or if the Droplet reboots.
    *   `-v /var/offert_data/db:/usr/src/app/db`: **Crucial for data persistence.** Mounts the `/var/offert_data/db` directory on your Droplet into `/usr/src/app/db` inside the container. The `offert_db.sqlite` file will be stored here.
    *   `-e SESSION_SECRET="YOUR_ACTUAL_VERY_STRONG_AND_UNIQUE_SECRET"`: **Set a strong, unique session secret!** Do not use the example value.
    *   `-e PORT="3000"`: Explicitly tells your application inside the container which port to listen on. This should match the internal port exposed by your Dockerfile and mapped by the `-p` option's container-side port.
    *   `--name offert-container`: Gives your container a memorable name, making it easier to manage.
    *   `YOUR_DOCKERHUB_USERNAME/offert-app:latest`: Your image.

    *Note: `NODE_ENV=production` is already set in the Dockerfile, so you don't strictly need to pass `-e NODE_ENV=production` here, but it doesn't hurt if you want to be explicit.*

## Step 6: Accessing Your Application

Once the container is running, you should be able to access your application in a web browser using your Droplet's IP address:

`http://YOUR_DROPLET_IP_ADDRESS`

(If you mapped to a different host port in the `docker run` command, e.g., `-p 3001:3000`, then you'd use `http://YOUR_DROPLET_IP_ADDRESS:3001`)

**Firewall:** The DigitalOcean "Docker on Ubuntu" image usually has `ufw` (firewall) configured to allow common ports like 80 and 443. If you have issues connecting, ensure port 80 (or the host port you used) is allowed:
```shell
sudo ufw status
sudo ufw allow 80/tcp # Or your chosen port
```

## Step 7: Managing the Container

Here are some basic Docker commands to manage your container on the Droplet:

*   **List running containers:**
    ```shell
    docker ps
    ```
*   **List all containers (including stopped ones):**
    ```shell
    docker ps -a
    ```
*   **View container logs:**
    ```shell
    docker logs offert-container
    # Use -f to follow logs: docker logs -f offert-container
    ```
*   **Stop the container:**
    ```shell
    docker stop offert-container
    ```
*   **Start a stopped container:**
    ```shell
    docker start offert-container
    ```
*   **Remove a container (must be stopped first):**
    ```shell
    docker rm offert-container
    ```

## Step 8: Updating the Application

To update your application with a new version:

1.  **Build the new image locally** (e.g., with a new tag or `:latest`):
    ```shell
    docker build -t YOUR_DOCKERHUB_USERNAME/offert-app:new-version .
    # or
    docker build -t YOUR_DOCKERHUB_USERNAME/offert-app:latest .
    ```
2.  **Push the new image to your container registry:**
    ```shell
    docker push YOUR_DOCKERHUB_USERNAME/offert-app:new-version
    # or
    docker push YOUR_DOCKERHUB_USERNAME/offert-app:latest
    ```
3.  **On your DigitalOcean Droplet (SSH in):**
    *   **Pull the new image:**
        ```shell
        docker pull YOUR_DOCKERHUB_USERNAME/offert-app:new-version
        # or
        docker pull YOUR_DOCKERHUB_USERNAME/offert-app:latest
        ```
    *   **Stop the currently running container:**
        ```shell
        docker stop offert-container
        ```
    *   **Remove the old container:**
        ```shell
        docker rm offert-container
        ```
    *   **Start a new container with the new image, ensuring you use the *exact same* volume mount and environment variables:**
        ```shell
        docker run -d -p 80:3000 --restart always \
            -v /var/offert_data/db:/usr/src/app/db \
            -e SESSION_SECRET="YOUR_ACTUAL_VERY_STRONG_AND_UNIQUE_SECRET" \
            -e PORT="3000" \
            --name offert-container \
            YOUR_DOCKERHUB_USERNAME/offert-app:new-version # Use the new image tag
        ```
        Your data in `/var/offert_data/db` will be preserved and used by the new container.

## Step 9: Important Notes and Best Practices

*   **Session Secret:** The `SESSION_SECRET` must be a strong, unique, and randomly generated string. Do not use weak secrets or commit actual secrets to your Git repository. Pass it as an environment variable during `docker run`.
*   **Database Backups:** While Docker volumes persist data, regularly back up your SQLite database file located in `/var/offert_data/db` on your Droplet. You can use `cron` jobs and tools like `rsync` or `scp`.
*   **HTTPS/SSL:** For a production application, you **must** set up HTTPS. You can do this using a reverse proxy like Nginx or Caddy in front of your Docker container to handle SSL termination. Let's Encrypt provides free SSL certificates.
*   **Resource Limits:** For larger applications, consider setting resource limits (CPU, memory) for your Docker containers.
*   **Docker Compose:** For more complex applications or multi-container setups (e.g., if you later add a separate database server or reverse proxy container), look into using `docker-compose` to define and manage your services.
*   **Logging:** For production, consider setting up more robust logging solutions that aggregate logs from Docker containers (e.g., ELK stack, Grafana Loki, or cloud provider logging services).

This guide should provide a solid foundation for deploying your Dockerized Offert application on DigitalOcean.
