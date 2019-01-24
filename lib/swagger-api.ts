import 'reflect-metadata';
import * as Koa from 'koa';
import * as fs from 'fs';
import * as path from 'path';
import * as mount from 'koa-mount';
import * as koaStatic from 'koa-static';
import * as SwaggerUIDist from 'swagger-ui-dist';
import { Application } from './application';
import {
  METADATA_ROUTER_METHOD,
  METADATA_ROUTER_PATH,
  METADATA_API_USETAGS,
  METADATA_API_OPERATION,
  METADATA_API_DESCRIPTION,
} from './constants';

export interface ISwaggerOption {
  url: string;
  prefix?: string;
}

export function useSwaggerApi(app: Application, swaggerConfig: ISwaggerOption) {
  const pathToSwaggerUi = SwaggerUIDist.getAbsoluteFSPath();
  app.getKoaInstance().use(
    mount((swaggerConfig.prefix || '/api') + '/index.html', async (ctx: Koa.Context) => {
      const d: string = await new Promise((resolve, reject) => {
        fs.readFile(path.join(pathToSwaggerUi, 'index.html'), (err, data) => {
          if (err) return reject(err.message);
          resolve(data.toString());
        });
      });
      ctx.type = 'text/html';
      ctx.body = d.replace(/url:\s*?"\S*"/gi, `url:"${swaggerConfig.url}"`);
    }),
  );
  app.getKoaInstance().use(
    mount(swaggerConfig.url, (ctx: Koa.Context) => {
      ctx.body = generateApi(app.getRouters());
    }),
  );
  app.getKoaInstance().use(mount(swaggerConfig.prefix || '/api', koaStatic(pathToSwaggerUi)));
}

interface IAPI {
  swagger: string;
  paths: { [prop: string]: { [prop: string]: IPath } };
  info: any;
  basePath: string;
  consumes: Array<string>;
  produces: Array<string>;
  schemes: Array<string>;
  tags: Array<{ name: string; description?: string }>;
}

interface IPath {
  summary: string;
  tags: Array<string>;
  produces: Array<string>;
  responses: any;
  parameters: Array<any>;
}

const api: IAPI = {
  swagger: '2.0',
  info: {
    title: '接口文档',
    description: 'Test API',
    // version: '1.0.0',
  },
  //  the domain of the service
  //  host: 127.0.0.1:3457
  schemes: ['http'],
  basePath: '',
  consumes: ['application/json', 'application/x-www-form-urlencoded'],
  produces: ['application/json'],
  paths: {},
  tags: [],
};
function generateApi(controllers: Array<any>): IAPI {
  controllers.forEach((Controller: any) => {
    const requestMappings = getRequestMappings(Controller.prototype);

    const tag = Reflect.getMetadata(METADATA_API_USETAGS, Controller);
    const description = Reflect.getMetadata(METADATA_API_DESCRIPTION, Controller) || '';

    api.tags.push({ name: tag, description });

    requestMappings.forEach(prop => {
      const requestPath: string = [
        Reflect.getMetadata(METADATA_ROUTER_PATH, Controller),
        Reflect.getMetadata(METADATA_ROUTER_PATH, Controller.prototype, prop),
      ].join('');

      const requestMethod: string = Reflect.getMetadata(METADATA_ROUTER_METHOD, Controller.prototype, prop);

      const operation = Reflect.getMetadata(METADATA_API_OPERATION, Controller.prototype, prop);

      const obj: IPath = {
        summary: operation,
        tags: [tag],
        produces: ['application/json'],
        responses: { 200: { code: 200, message: '', result: '' } },
        parameters: [],
      };

      api.paths[requestPath] = { [requestMethod.toLowerCase()]: obj };
    });
  });
  return api;
}

function getRequestMappings(router: any): Array<string> {
  return Object.getOwnPropertyNames(router).filter(prop => {
    return (
      prop !== 'constructor' &&
      typeof router[prop] === 'function' &&
      Reflect.hasMetadata(METADATA_ROUTER_METHOD, router, prop)
    );
  });
}
