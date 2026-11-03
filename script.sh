#!bin/bash


docker-compose down

echo " application stopped "


stop 30secs

docker-compose up -d

echo " application started "
