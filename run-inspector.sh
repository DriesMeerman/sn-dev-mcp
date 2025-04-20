#!/bin/bash

# Exit script on any error
set -e

# --- Configuration ---
# Path to your .env file (relative to project root where npm runs)
ENV_FILE=".env"
# Path to your built index file (relative to project root)
INDEX_JS="dist/index.js"
# --- End Configuration ---

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file '$ENV_FILE' not found."
  exit 1
fi

# Source the .env file safely to load variables
# This method avoids issues with comments or potentially problematic lines
# by filtering first and then exporting.
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# Alternatively, a simpler source if your .env is clean:
# set -o allexport # Export all variables defined after this
# source "$ENV_FILE"
# set +o allexport # Stop exporting

# Check if required variables are set
if [ -z "${SN_USER:-}" ] || [ -z "${SN_PASSWORD:-}" ] || [ -z "${SN_INSTANCE:-}" ]; then
  echo "Error: Missing required variables (SN_USER, SN_PASSWORD, SN_INSTANCE) in $ENV_FILE"
  exit 1
fi

echo "Environment variables loaded successfully."

# Construct the connection string (use double quotes for variable expansion)
CONNECTION_STRING="https://${SN_USER}:${SN_PASSWORD}@${SN_INSTANCE}.service-now.com"

# Execute the inspector command
echo "Running inspector command..."
npx @modelcontextprotocol/inspector node "$INDEX_JS" \
  --connection-string "$CONNECTION_STRING"

echo "Inspector command finished."

exit 0