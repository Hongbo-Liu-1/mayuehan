# mayuehan

## Programming

Original developed on Heroku using Node.js with typescript
https://devcenter.heroku.com/articles/getting-started-with-nodejs
```
$ node --version
v10.15.3
```
To compile typescript to js, run
```
$ yarn compile
```
or simply
```
$ python scripts/compile_ts.py
```

## Run app locally
```
$ yarn install

$ yarn compile
```

Run database locally (see Database section)

To start locally, run the following script:
```
$ ./r
```

On browser, open URL:
http://localhost:8100/


## Database

Postgres 9 or later

- create database

- run scripts/postgresql/database-setup/init.sql to create all tables in your database

-  update /config/local.yml with your database configuration
