import type { BackendFramework, ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";
import { ExpressGenerator } from "./express.js";
import { FastifyGenerator } from "./fastify.js";
import { HonoGenerator } from "./hono.js";
import { ElysiaGenerator } from "./elysia.js";
import { NestJSGenerator } from "./nestjs.js";
import { ConvexGenerator } from "./convex.js";
import { NextJSAPIGenerator } from "./nextjs-api.js";

export {
  BaseBackendGenerator,
  ExpressGenerator,
  FastifyGenerator,
  HonoGenerator,
  ElysiaGenerator,
  NestJSGenerator,
  ConvexGenerator,
  NextJSAPIGenerator,
};

export type BackendGenerator =
  | BaseBackendGenerator
  | ConvexGenerator
  | NextJSAPIGenerator;

/**
 * Factory function to get the appropriate backend generator
 */
export function getBackendGenerator(framework: BackendFramework): BackendGenerator | null {
  switch (framework) {
    case "express":
      return new ExpressGenerator();
    case "fastify":
      return new FastifyGenerator();
    case "hono":
      return new HonoGenerator();
    case "elysia":
      return new ElysiaGenerator();
    case "nestjs":
      return new NestJSGenerator();
    case "convex":
      return new ConvexGenerator();
    case "nextjs-builtin":
      return new NextJSAPIGenerator();
    case "none":
    default:
      return null;
  }
}

/**
 * Check if the backend framework requires a separate package (monorepo)
 */
export function requiresSeparatePackage(framework: BackendFramework): boolean {
  const separatePackageBackends: BackendFramework[] = [
    "express",
    "fastify",
    "hono",
    "elysia",
    "nestjs",
  ];
  return separatePackageBackends.includes(framework);
}

/**
 * Check if the backend framework integrates with the frontend project
 */
export function integratesWithFrontend(framework: BackendFramework): boolean {
  const integratedBackends: BackendFramework[] = [
    "nextjs-builtin",
    "convex",
  ];
  return integratedBackends.includes(framework);
}

/**
 * Get the backend package name for monorepo setups
 */
export function getBackendPackageName(config: ProjectConfig): string {
  return `${config.projectName}-backend`;
}

/**
 * Get the frontend package name for monorepo setups
 */
export function getFrontendPackageName(config: ProjectConfig): string {
  return `${config.projectName}-frontend`;
}
