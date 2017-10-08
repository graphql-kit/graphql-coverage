#!/usr/bin/env node
import * as path from 'path';
import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';
import {red, green, blue} from 'chalk';
import fetch from 'node-fetch';
import { Kind, TypeInfo, print, visit, visitWithTypeInfo, buildClientSchema, introspectionQuery } from 'graphql';

const coverage = {};
const originUrl = process.argv[2];
if (!originUrl) throw Error('Specify URL as the 1st argument!');

(async () => {
  const {errors, data} = await graphqlFetch({query: introspectionQuery});
  if (errors) throw Error(JSON.stringify(errors, null, 2));
  const schema = buildClientSchema(data);
  const app = express();
  const formatErrorFn = (err) => err;
  app.use('/graphql', graphqlHTTP({ schema, execute, graphiql: true, formatErrorFn }));
  app.get('/coverage-map', (_, res) => res.status(200).json(coverage));
  app.use('/coverage', express.static(path.join(__dirname, 'static')));
  app.listen(9003);
  console.log(`\n${green('✔')} Your GraphQL Fake API is ready to use 🚀 \n
  ${blue('❯')} Coverage Graph:\t http://localhost:9003/coverage
  ${blue('❯')} GraphQL API:\t http://localhost:9003/graphql`);
})()
  .catch(error => console.error(red(error.stack)));

async function graphqlFetch(body) {
  const res = await fetch(originUrl, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok)
    throw Error(`${res.status} ${res.statusText}\n${await res.text()}`);
  return res.json();
}
async function execute({schema, document, variableValues: variables, operationName}) {
  const typeInfo = new TypeInfo(schema);
  visit(document, visitWithTypeInfo(typeInfo, {
    [Kind.FIELD]: () => {
      const typeName = typeInfo.getParentType().name;
      const fieldName = typeInfo.getFieldDef().name;
      if (typeName.startsWith('__') || fieldName.startsWith('__')) return;
      coverage[`${typeName}::${fieldName}`] = true;
    },
  }));
  return await graphqlFetch({ query: print(document), variables, operationName });
}
