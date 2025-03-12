#!/bin/bash

# Make data directory
mkdir -p dovedata

# Clear data directory
rm -rf dovedata/*.csv

# Download data from dove to the dovedata directory
wget -P dovedata/ https://dove.cccbr.org.uk/dove.csv
wget -P dovedata/ https://dove.cccbr.org.uk/towers.csv
wget -P dovedata/ https://dove.cccbr.org.uk/bells.csv
wget -P dovedata/ https://dove.cccbr.org.uk/frames.csv
wget -P dovedata/ https://dove.cccbr.org.uk/regions.csv
wget -P dovedata/ https://dove.cccbr.org.uk/founders.csv
wget -P dovedata/ https://dove.cccbr.org.uk/changes.csv