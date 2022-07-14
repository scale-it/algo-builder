#!/bin/bash

for f in Makefile README.md private-net-template.json sandbox-docker-compose.yml 
do 
    cp ../../infrastructure/$f sample-project/infrastructure; 
done
