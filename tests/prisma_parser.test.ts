import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaSchemaParser } from '../src/parser/prisma-parser.js';

describe('PrismaSchemaParser Tests', () => {
  test('Parses Prisma models with relations, enums, and composite keys', () => {
    const prismaSchema = `
      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

      enum MembershipTier {
        BRONZE
        SILVER
        GOLD
        PLATINUM
      }

      model Organization {
        id        String   @id @default(uuid())
        name      String
        tier      MembershipTier @default(BRONZE)
        createdAt DateTime @default(now())
        members   Member[]
      }

      model User {
        id        String   @id @default(cuid())
        email     String   @unique
        avatarUrl String?
        members   Member[]
      }

      model Member {
        orgId  String
        userId String
        role   String @default("DEVELOPER")

        org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
        user User         @relation(fields: [userId], references: [id])

        @@id([orgId, userId])
      }
    `;

    const schema = PrismaSchemaParser.parse(prismaSchema);

    assert.equal(schema.tables.length, 3);
    assert.ok(schema.enums.MembershipTier !== undefined);
    assert.deepEqual(schema.enums.MembershipTier, ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

    // Organization model
    const org = schema.tables.find((t) => t.name === 'Organization');
    assert.ok(org !== undefined);
    assert.deepEqual(org?.primaryKey, ['id']);
    // Virtual relation navigation field 'members' should not be a scalar column
    assert.equal(org?.columns.some((c) => c.name === 'members'), false);

    // Member model (Junction table)
    const member = schema.tables.find((t) => t.name === 'Member');
    assert.ok(member !== undefined);
    // Composite Primary Key
    assert.deepEqual(member?.primaryKey, ['orgId', 'userId']);
    // 2 foreign keys
    assert.equal(member?.foreignKeys.length, 2);

    const orgFk = member?.foreignKeys.find((f) => f.sourceColumn === 'orgId');
    assert.equal(orgFk?.targetTable, 'Organization');
    assert.equal(orgFk?.onDelete, 'Cascade');

    const userFk = member?.foreignKeys.find((f) => f.sourceColumn === 'userId');
    assert.equal(userFk?.targetTable, 'User');
    assert.equal(userFk?.targetColumn, 'id');
  });
});
