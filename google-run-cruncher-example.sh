#!/bin/bash

# This is an example of a script capable of launching the cruncher on google cloud
# it's meant to launch the cruncher, have it do its thing, then automatically bring the google cloud service down, optimizing resource usage
# review and configure accordingly before executing

echo "executing gcloud"
echo $(date)
gcloud compute --project "osma-174310" instances create "osma-cruncher" --zone "us-central1-c" --machine-type "custom-16-30720" --subnet "default" --maintenance-policy "MIGRATE" --service-account <your google data> --scopes "https://www.googleapis.com/auth/cloud-platform" --image "osma-cruncher-v2" --image-project "osma-174310" --boot-disk-size "100" --boot-disk-type "pd-ssd" --boot-disk-device-name "osma-cruncher"
echo "finished"