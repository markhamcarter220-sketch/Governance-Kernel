/**
 * HTTP API routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyWorkflow } from '../kernel/verify';
import { scanArtifact } from '../kernel/scan';
import { Workflow } from '../kernel/types';

interface VerifyRequestBody {
  workflow: Workflow;
}

interface ScanRequestBody {
  text: string;
  type: string;
}

export async function registerRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'ok', service: 'governance-kernel' };
  });

  // Verify workflow
  server.post(
    '/verify',
    async (request: FastifyRequest<{ Body: VerifyRequestBody }>, reply: FastifyReply) => {
      try {
        const { workflow } = request.body;

        if (!workflow) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Missing workflow in request body',
          });
        }

        const result = verifyWorkflow(workflow);

        const statusCode = result.freeze?.frozen ? 409 : result.valid ? 200 : 422;

        return reply.code(statusCode).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({
            error: 'Validation Error',
            message: error.message,
          });
        }
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Unknown error occurred',
        });
      }
    }
  );

  // Scan artifact
  server.post(
    '/scan',
    async (request: FastifyRequest<{ Body: ScanRequestBody }>, reply: FastifyReply) => {
      try {
        const { text, type } = request.body;

        if (!text) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Missing text in request body',
          });
        }

        const artifactType = type || 'unknown';
        const result = scanArtifact(text, artifactType);

        const statusCode = result.clean ? 200 : 422;

        return reply.code(statusCode).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({
            error: 'Validation Error',
            message: error.message,
          });
        }
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Unknown error occurred',
        });
      }
    }
  );
}
