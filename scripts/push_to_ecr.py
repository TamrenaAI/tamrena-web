import os
import sys
import subprocess
import argparse

# Load .env variables if present
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

def get_aws_cli():
    # Common locations for AWS CLI
    paths = [
        "aws",
        r"C:\Program Files\Amazon\AWSCLIV2\aws.exe",
        r"C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe"
    ]
    for p in paths:
        try:
            res = subprocess.run([p, "--version"], capture_output=True, text=True)
            if res.returncode == 0:
                return p
        except Exception:
            continue
    return "aws"

def main():
    parser = argparse.ArgumentParser(description="Push Docker images to AWS ECR")
    parser.add_argument("--account", default="703621194052", help="AWS Account ID")
    parser.add_argument("--region", default="eu-north-1", help="AWS Region")
    parser.add_argument("--tag", default="latest", help="Tag for pushed images")
    parser.add_argument("--images", nargs="*", help="Specific image names to push (default: all tamreena images)")

    args = parser.parse_args()
    load_env()

    aws_cli = get_aws_cli()
    account_id = args.account
    region = args.region
    tag = args.tag
    registry = f"{account_id}.dkr.ecr.{region}.amazonaws.com"

    print(f"=== Tamreena AWS ECR Image Push ===")
    print(f"Registry: {registry}")
    print(f"Region:   {region}")
    print(f"Tag:      {tag}\n")

    # 1. AWS ECR Login
    print("[1/4] Authenticating with AWS ECR...")
    try:
        login_pass = subprocess.run([aws_cli, "ecr", "get-login-password", "--region", region],
                                    capture_output=True, text=True, check=True).stdout
        docker_login = subprocess.run(["docker", "login", "--username", "AWS", "--password-stdin", registry],
                                      input=login_pass, capture_output=True, text=True, check=True)
        print(" -> Docker login to ECR succeeded!")
    except Exception as e:
        print(f" -> ERROR: ECR Login failed: {e}")
        sys.exit(1)

    # 2. Define Image Map (Local Image Name -> ECR Repository Name)
    default_image_map = {
        "tamreena-web-frontend": "tamreena-web-frontend",
        "tamreena-web-backend": "tamreena-web-backend",
        "tamreena_ai-api": "tamreena-ai-api",
        "computer-vision-backend": "computer-vision-backend",
        "computer-vision-frontend": "computer-vision-frontend",
        "exercises-hub-backend": "exercises-hub-backend",
        "exercises-hub-frontend": "exercises-hub-frontend",
        "live-session-backend": "live-session-backend",
        "live-session-frontend": "live-session-frontend",
        "tamrena-workout": "tamrena-workout"
    }

    if args.images:
        selected_map = {img: default_image_map.get(img, img) for img in args.images}
    else:
        selected_map = default_image_map

    # 3. Check existing local docker images
    print("\n[2/4] Checking local Docker images...")
    res = subprocess.run(["docker", "images", "--format", "{{.Repository}}:{{.Tag}}"], capture_output=True, text=True)
    local_images = [line.strip() for line in res.stdout.splitlines() if line.strip()]

    to_push = []
    for local_name, ecr_repo in selected_map.items():
        found = any(img.startswith(f"{local_name}:") for img in local_images)
        if found:
            to_push.append((local_name, ecr_repo))
            print(f" -> Found local image: {local_name}")
        else:
            print(f" -> Skipping (not found locally): {local_name}")

    if not to_push:
        print("\nNo matching local images found to push!")
        sys.exit(0)

    # 4. Create missing ECR repositories and push
    print("\n[3/4] Ensuring ECR Repositories exist...")
    # List existing repos
    res = subprocess.run([aws_cli, "ecr", "describe-repositories", "--region", region], capture_output=True, text=True)
    existing_repos = []
    if res.returncode == 0:
        import json
        data = json.loads(res.stdout)
        existing_repos = [r["repositoryName"] for r in data.get("repositories", [])]

    for local_name, ecr_repo in to_push:
        if ecr_repo not in existing_repos:
            print(f" -> Creating missing ECR repo: {ecr_repo}...")
            create_res = subprocess.run([aws_cli, "ecr", "create-repository", "--repository-name", ecr_repo, "--region", region], capture_output=True, text=True)
            if create_res.returncode == 0:
                print(f"    Created ECR repo '{ecr_repo}' successfully.")
            else:
                print(f"    Warning creating repo '{ecr_repo}': {create_res.stderr.strip()}")
        else:
            print(f" -> ECR repo '{ecr_repo}' exists.")

    print("\n[4/4] Tagging and Pushing Docker Images to AWS ECR...")
    pushed_summary = []
    for local_name, ecr_repo in to_push:
        remote_uri = f"{registry}/{ecr_repo}:{tag}"
        print(f"\n--- Tagging {local_name}:latest -> {remote_uri} ---")
        tag_res = subprocess.run(["docker", "tag", f"{local_name}:latest", remote_uri], capture_output=True, text=True)
        if tag_res.returncode != 0:
            print(f"Failed to tag {local_name}: {tag_res.stderr}")
            continue

        print(f"--- Pushing {remote_uri} ---")
        push_res = subprocess.run(["docker", "push", remote_uri], text=True)
        if push_res.returncode == 0:
            pushed_summary.append((local_name, remote_uri))
            print(f"SUCCESS: Pushed {remote_uri}")
        else:
            print(f"ERROR: Failed to push {remote_uri}")

    print("\n==========================================")
    print("FINISHED PUSHING TO AWS ECR")
    print("==========================================")
    for local_name, remote_uri in pushed_summary:
        print(f"  * {local_name} -> {remote_uri}")

if __name__ == "__main__":
    main()
