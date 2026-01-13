import type { ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";

export class NestJSGenerator extends BaseBackendGenerator {
  framework = "nestjs" as const;

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));
    await this.writeJSON(projectPath, "tsconfig.json", this.getNestTSConfig());
    await this.writeJSON(projectPath, "tsconfig.build.json", this.getTSConfigBuild());
    await this.writeJSON(projectPath, "nest-cli.json", this.getNestCLIConfig());

    // Main files
    await this.writeFile(projectPath, "src/main.ts", this.getMainFile());
    await this.writeFile(projectPath, "src/app.module.ts", this.getAppModule(config));
    await this.writeFile(projectPath, "src/app.controller.ts", this.getAppController());
    await this.writeFile(projectPath, "src/app.service.ts", this.getAppService());

    // Users module
    await this.writeFile(projectPath, "src/modules/users/users.module.ts", this.getUsersModule());
    await this.writeFile(projectPath, "src/modules/users/users.controller.ts", this.getUsersController());
    await this.writeFile(projectPath, "src/modules/users/users.service.ts", this.getUsersService());
    await this.writeFile(projectPath, "src/modules/users/dto/create-user.dto.ts", this.getCreateUserDto());
    await this.writeFile(projectPath, "src/modules/users/dto/update-user.dto.ts", this.getUpdateUserDto());
    await this.writeFile(projectPath, "src/modules/users/entities/user.entity.ts", this.getUserEntity());

    // Items module
    await this.writeFile(projectPath, "src/modules/items/items.module.ts", this.getItemsModule());
    await this.writeFile(projectPath, "src/modules/items/items.controller.ts", this.getItemsController());
    await this.writeFile(projectPath, "src/modules/items/items.service.ts", this.getItemsService());
    await this.writeFile(projectPath, "src/modules/items/dto/create-item.dto.ts", this.getCreateItemDto());
    await this.writeFile(projectPath, "src/modules/items/dto/update-item.dto.ts", this.getUpdateItemDto());
    await this.writeFile(projectPath, "src/modules/items/entities/item.entity.ts", this.getItemEntity());

    // Health module
    await this.writeFile(projectPath, "src/modules/health/health.module.ts", this.getHealthModule());
    await this.writeFile(projectPath, "src/modules/health/health.controller.ts", this.getHealthController());

    // Common components
    await this.writeFile(projectPath, "src/common/filters/http-exception.filter.ts", this.getHttpExceptionFilter());
    await this.writeFile(projectPath, "src/common/interceptors/logging.interceptor.ts", this.getLoggingInterceptor());
    await this.writeFile(projectPath, "src/common/interceptors/transform.interceptor.ts", this.getTransformInterceptor());
    await this.writeFile(projectPath, "src/common/pipes/validation.pipe.ts", this.getValidationPipe());
    await this.writeFile(projectPath, "src/common/dto/pagination.dto.ts", this.getPaginationDto());

    // Database files
    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }

    // Config files
    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".gitignore", this.getBackendGitignore());
    await this.writeFile(projectPath, ".eslintrc.js", this.getEslintConfig());
    await this.writeFile(projectPath, ".prettierrc", this.getPrettierConfig());

    // Docker
    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getBackendDockerfile(config));
    }

    // Tests
    if (config.extras.testing) {
      await this.writeFile(projectPath, "test/app.e2e-spec.ts", this.getE2ETest());
      await this.writeFile(projectPath, "test/jest-e2e.json", this.getJestE2EConfig());
    }
  }

  getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {
      prebuild: "rimraf dist",
      build: "nest build",
      format: "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
      start: "nest start",
      "start:dev": "nest start --watch",
      "start:debug": "nest start --debug --watch",
      "start:prod": "node dist/main",
      dev: "nest start --watch",
      lint: "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
      test: "jest",
      "test:watch": "jest --watch",
      "test:cov": "jest --coverage",
      "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
      "test:e2e": "jest --config ./test/jest-e2e.json",
    };

    if (config.orm === "prisma") {
      scripts["db:generate"] = "prisma generate";
      scripts["db:push"] = "prisma db push";
      scripts["db:migrate"] = "prisma migrate dev";
      scripts["db:studio"] = "prisma studio";
    }

    if (config.orm === "drizzle") {
      scripts["db:generate"] = "drizzle-kit generate";
      scripts["db:push"] = "drizzle-kit push";
      scripts["db:migrate"] = "drizzle-kit migrate";
      scripts["db:studio"] = "drizzle-kit studio";
    }

    return scripts;
  }

  getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      "@nestjs/common": "^10.4.0",
      "@nestjs/core": "^10.4.0",
      "@nestjs/platform-express": "^10.4.0",
      "@nestjs/config": "^3.3.0",
      "class-transformer": "^0.5.1",
      "class-validator": "^0.14.1",
      "reflect-metadata": "^0.2.0",
      rxjs: "^7.8.0",
      ...this.getCommonDependencies(config),
    };

    return deps;
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    return {
      "@nestjs/cli": "^10.4.0",
      "@nestjs/schematics": "^10.2.0",
      "@nestjs/testing": "^10.4.0",
      "@types/express": "^5.0.0",
      "@types/jest": "^29.5.0",
      "@types/supertest": "^6.0.0",
      "@typescript-eslint/eslint-plugin": "^8.0.0",
      "@typescript-eslint/parser": "^8.0.0",
      eslint: "^9.0.0",
      "eslint-config-prettier": "^9.1.0",
      "eslint-plugin-prettier": "^5.2.0",
      jest: "^29.7.0",
      prettier: "^3.4.0",
      rimraf: "^6.0.0",
      "source-map-support": "^0.5.21",
      supertest: "^7.0.0",
      "ts-jest": "^29.2.0",
      "ts-loader": "^9.5.0",
      "ts-node": "^10.9.0",
      "tsconfig-paths": "^4.2.0",
      ...this.getCommonDevDependencies(config),
    };
  }

  private getNestTSConfig(): object {
    return {
      compilerOptions: {
        module: "commonjs",
        declaration: true,
        removeComments: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        allowSyntheticDefaultImports: true,
        target: "ES2022",
        sourceMap: true,
        outDir: "./dist",
        baseUrl: "./",
        incremental: true,
        skipLibCheck: true,
        strictNullChecks: true,
        noImplicitAny: true,
        strictBindCallApply: true,
        forceConsistentCasingInFileNames: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          "@/*": ["src/*"],
        },
      },
    };
  }

  private getTSConfigBuild(): object {
    return {
      extends: "./tsconfig.json",
      exclude: ["node_modules", "test", "dist", "**/*spec.ts"],
    };
  }

  private getNestCLIConfig(): object {
    return {
      $schema: "https://json.schemastore.org/nest-cli",
      collection: "@nestjs/schematics",
      sourceRoot: "src",
      compilerOptions: {
        deleteOutDir: true,
      },
    };
  }

  private getMainFile(): string {
    return `import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 4000);
  const corsOrigin = configService.get<string>("CORS_ORIGIN", "http://localhost:3000");

  // Global prefix
  app.setGlobalPrefix("api");

  // CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  await app.listen(port);
  logger.log(\`Server running on http://localhost:\${port}\`);
}

bootstrap();
`;
  }

  private getAppModule(_config: ProjectConfig): string {
    return `import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./modules/users/users.module";
import { ItemsModule } from "./modules/items/items.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    UsersModule,
    ItemsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;
  }

  private getAppController(): string {
    return `import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
`;
  }

  private getAppService(): string {
    return `import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "Welcome to the API!";
  }
}
`;
  }

  // Users Module
  private getUsersModule(): string {
    return `import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
`;
  }

  private getUsersController(): string {
    return `import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
`;
  }

  private getUsersService(): string {
    return `import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Injectable()
export class UsersService {
  private users = new Map<string, User>();

  create(createUserDto: CreateUserDto): User {
    const id = crypto.randomUUID();
    const user: User = {
      id,
      ...createUserDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const allUsers = Array.from(this.users.values());
    const start = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(start, start + limit);

    return {
      data: paginatedUsers,
      meta: {
        total: allUsers.length,
        page,
        limit,
        totalPages: Math.ceil(allUsers.length / limit),
      },
    };
  }

  findOne(id: string): User {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(\`User with ID "\${id}" not found\`);
    }
    return user;
  }

  update(id: string, updateUserDto: UpdateUserDto): User {
    const user = this.findOne(id);
    const updated: User = {
      ...user,
      ...updateUserDto,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(\`User with ID "\${id}" not found\`);
    }
    this.users.delete(id);
  }
}
`;
  }

  private getCreateUserDto(): string {
    return `import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
`;
  }

  private getUpdateUserDto(): string {
    return `import { PartialType } from "@nestjs/common";
import { CreateUserDto } from "./create-user.dto";
import { OmitType } from "@nestjs/common";

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ["password"] as const),
) {}
`;
  }

  private getUserEntity(): string {
    return `export class User {
  id: string;
  email: string;
  name: string;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}
`;
  }

  // Items Module
  private getItemsModule(): string {
    return `import { Module } from "@nestjs/common";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";

@Module({
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
`;
  }

  private getItemsController(): string {
    return `import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ItemsService } from "./items.service";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Controller("items")
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createItemDto: CreateItemDto) {
    return this.itemsService.create(createItemDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.itemsService.findAll(paginationDto);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.itemsService.findOne(id);
  }

  @Put(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.itemsService.update(id, updateItemDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.itemsService.remove(id);
  }
}
`;
  }

  private getItemsService(): string {
    return `import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { Item } from "./entities/item.entity";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Injectable()
export class ItemsService {
  private items = new Map<string, Item>();

  create(createItemDto: CreateItemDto): Item {
    const id = crypto.randomUUID();
    const item: Item = {
      id,
      ...createItemDto,
      status: createItemDto.status || "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(id, item);
    return item;
  }

  findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const allItems = Array.from(this.items.values());
    const start = (page - 1) * limit;
    const paginatedItems = allItems.slice(start, start + limit);

    return {
      data: paginatedItems,
      meta: {
        total: allItems.length,
        page,
        limit,
        totalPages: Math.ceil(allItems.length / limit),
      },
    };
  }

  findOne(id: string): Item {
    const item = this.items.get(id);
    if (!item) {
      throw new NotFoundException(\`Item with ID "\${id}" not found\`);
    }
    return item;
  }

  update(id: string, updateItemDto: UpdateItemDto): Item {
    const item = this.findOne(id);
    const updated: Item = {
      ...item,
      ...updateItemDto,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    const item = this.items.get(id);
    if (!item) {
      throw new NotFoundException(\`Item with ID "\${id}" not found\`);
    }
    this.items.delete(id);
  }
}
`;
  }

  private getCreateItemDto(): string {
    return `import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from "class-validator";

export enum ItemStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsEnum(ItemStatus)
  @IsOptional()
  status?: ItemStatus;
}
`;
  }

  private getUpdateItemDto(): string {
    return `import { PartialType } from "@nestjs/common";
import { CreateItemDto } from "./create-item.dto";

export class UpdateItemDto extends PartialType(CreateItemDto) {}
`;
  }

  private getItemEntity(): string {
    return `export class Item {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
`;
  }

  // Health Module
  private getHealthModule(): string {
    return `import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
`;
  }

  private getHealthController(): string {
    return `import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
`;
  }

  // Common Components
  private getHttpExceptionFilter(): string {
    return `import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    const errorResponse = {
      error: {
        code: this.getErrorCode(status),
        message: typeof message === "string" ? message : (message as any).message || message,
        ...(typeof message === "object" && (message as any).message
          ? { details: (message as any).message }
          : {}),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(
      \`\${request.method} \${request.url} - \${status}: \${JSON.stringify(errorResponse)}\`,
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return "VALIDATION_ERROR";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      default:
        return "INTERNAL_ERROR";
    }
  }
}
`;
  }

  private getLoggingInterceptor(): string {
    return `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const responseTime = Date.now() - now;
        this.logger.log(\`\${method} \${url} \${statusCode} - \${responseTime}ms\`);
      }),
    );
  }
}
`;
  }

  private getTransformInterceptor(): string {
    return `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If response already has data property, return as-is
        if (data && typeof data === "object" && "data" in data) {
          return data;
        }
        // Otherwise wrap in data property
        return { data };
      }),
    );
  }
}
`;
  }

  private getValidationPipe(): string {
    return `import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      throw new BadRequestException({
        message: "Validation failed",
        errors: messages,
      });
    }
    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
`;
  }

  private getPaginationDto(): string {
    return `import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
`;
  }

  private getEslintConfig(): string {
    return `module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint/eslint-plugin"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
};
`;
  }

  private getPrettierConfig(): string {
    return `{
  "singleQuote": false,
  "trailingComma": "all"
}
`;
  }

  private getE2ETest(): string {
    return `import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/api")
      .expect(200)
      .expect("Welcome to the API!");
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty("status", "ok");
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body).toHaveProperty("uptime");
      });
  });

  describe("Users", () => {
    let userId: string;

    it("/users (POST)", () => {
      return request(app.getHttpServer())
        .post("/api/users")
        .send({
          email: "test@example.com",
          name: "Test User",
          password: "password123",
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty("id");
          expect(res.body.data.email).toBe("test@example.com");
          userId = res.body.data.id;
        });
    });

    it("/users (GET)", () => {
      return request(app.getHttpServer())
        .get("/api/users")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("data");
          expect(res.body).toHaveProperty("meta");
        });
    });
  });
});
`;
  }

  private getJestE2EConfig(): string {
    return `{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\\\.(t|j)s$": "ts-jest"
  }
}
`;
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    if (config.orm === "prisma") {
      await this.writeFile(projectPath, "prisma/schema.prisma", this.getPrismaSchema(config));
    }
    if (config.orm === "drizzle") {
      await this.writeFile(projectPath, "src/db/schema.ts", this.getDrizzleSchema(config));
      await this.writeFile(projectPath, "drizzle.config.ts", this.getDrizzleConfig(config));
    }
  }
}
