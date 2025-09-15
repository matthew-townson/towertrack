# Towertracker

Track where you've grabbed bells, or rung Quarter Peals and Peals.  
More features coming soon!  

# Contents

- [Running towertracker](#running-towertracker)
- [Running towertracker in Development mode (with hot-reloading)](#running-towertracker-in-development-mode)
- [Setup](#setup)
- [Using towertracker](#using-towertracker)

## Running towertracker

This app is dockerised!  

To run the containers, navigate to the towertracker directory and run  

```bash
docker-compose --profile main up --build
```

This by default runs the app on port `3000` and the database on port `3306`  

## Running towertracker in Development mode

```bash
docker-compose --profile dev up --build
```

This runs the app on port `5173` and will reload whenever changes are made to files

## Setup

When running for the first time, an admin user is created with a random 8 alphanumeric password.  
This will be shown in the shell on first run and you are strongly recommended to change this on your first login.  

## Using towertracker

I'll be hosting an instance of towertracker at [coming soon](#), but you are more than welcome to run it yourself.  
