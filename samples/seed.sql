-- MockForge AI: PostgreSQL Relational Seed Script
-- Generated: 2026-11-06T18:00:11.498Z
-- Total Rows: 75 | Seed: 42

BEGIN;

-- Temporarily disable foreign key constraints and triggers for high-speed import
SET session_replication_role = 'replica';

-- Table: accounts (25 rows)
INSERT INTO "accounts" ("id", "org_nm", "acct_tier", "created_at") VALUES
  ('97da2849-d73e-4b43-8a90-7d090402c802', 'Solaris Renewable Energy', 'PRO', '2025-08-08T16:19:58.506Z'),
  ('700893a3-4bd8-4344-9aab-e1f6f210579e', 'Starlight Logistics', 'BUSINESS', '2025-06-23T17:19:19.073Z'),
  ('b28d1f9e-6959-45b4-bdbf-e6841b5ce17d', 'Nova Robotics', 'ENTERPRISE', '2026-03-26T06:58:25.278Z'),
  ('b362a53a-e5c6-42d5-8bae-e39720bb4450', 'Vanguard Global Capital', 'ENTERPRISE', '2025-11-03T00:16:28.048Z'),
  ('2284666a-65e5-4798-9354-5a32b5150937', 'CyberGuard Defense', 'BUSINESS', '2025-07-01T04:31:09.160Z'),
  ('72d8de72-9c36-48f7-9db0-128acfdadd95', 'Horizon Media', 'ENTERPRISE', '2025-09-24T15:37:04.841Z'),
  ('fa5d2501-abfe-47b2-8204-79bcc3a87776', 'Quantum BioSystems', 'STARTER', '2026-04-07T11:53:22.800Z'),
  ('488a6202-f1d6-481d-853b-91fcac8c8211', 'Starlight Logistics', 'STARTER', '2025-09-27T07:57:33.272Z'),
  ('8f0654d8-3ff4-48de-a9c4-7c8a88ffc4aa', 'Krypton Semiconductor', 'STARTER', '2025-07-14T16:23:34.780Z'),
  ('e658d9db-24f7-44ac-bb2d-e8717ea679b8', 'Apex Dynamics', 'FREE', '2026-04-25T21:05:32.481Z'),
  ('6dda104b-4dae-4e51-a374-4b8791cbe100', 'Quantum BioSystems', 'STARTER', '2026-03-08T00:13:50.671Z'),
  ('9d5a0bc6-3c82-41c6-9c7f-228a3c32a983', 'Onyx Enterprise Cloud', 'PRO', '2025-09-01T22:48:13.037Z'),
  ('f9405bc4-d72a-483d-92f3-7897a2fd538c', 'Horizon Media', 'PRO', '2026-02-27T12:00:57.014Z'),
  ('0d56480a-1eca-4c09-8787-790b0b25be49', 'Onyx Enterprise Cloud', 'PRO', '2026-05-14T10:22:53.285Z'),
  ('777c1b9f-d70e-4087-a89d-afffcfc21f07', 'Krypton Semiconductor', 'BUSINESS', '2025-08-20T16:08:12.815Z'),
  ('d7ea425b-0239-45af-acb0-ae49e76da578', 'Ironclad Security', 'FREE', '2025-10-25T22:12:37.497Z'),
  ('ac69d692-f2ab-498a-ac00-1e0080ba06d5', 'Summit Peak Technologies', 'BUSINESS', '2025-10-04T22:48:07.376Z'),
  ('a9d96969-32bb-44ef-a95a-feb5e8e325f8', 'Ironclad Security', 'FREE', '2025-10-05T09:30:58.521Z'),
  ('f4f3f486-34fa-4585-b29e-a8e9d7a79aa6', 'Summit Peak Technologies', 'FREE', '2025-09-13T14:49:43.607Z'),
  ('502a407b-2b34-4955-97d1-35edf72a9cf6', 'CyberGuard Defense', 'FREE', '2025-07-05T10:14:25.052Z'),
  ('20d1889f-8a8e-4e13-a6b8-7555ade3978b', 'Prism Interactive', 'PRO', '2025-06-01T18:40:46.071Z'),
  ('602015c8-76fb-475b-8941-d61f0c919e3d', 'Vanguard Global Capital', 'ENTERPRISE', '2025-12-17T13:58:50.849Z'),
  ('0606760f-c313-4bcf-9e3b-8d30dee320fa', 'Helix Pharmaceuticals', 'FREE', '2025-10-11T07:29:13.236Z'),
  ('c0d38514-ef83-40c0-a5ff-c2541a89a91e', 'OmniCorp Solutions', 'BUSINESS', '2025-12-29T04:36:14.846Z'),
  ('361f3399-8665-46b1-9aae-d7c27a63fe6e', 'Onyx Enterprise Cloud', 'FREE', '2025-11-30T03:13:36.743Z');

-- Table: account_users (25 rows)
INSERT INTO "account_users" ("id", "account_id", "c_fname", "c_lname", "c_eml", "c_tel", "kyc_st", "created_at") VALUES
  ('47c5b5f0-fb74-4454-b0b2-40c1b875a94c', '2284666a-65e5-4798-9354-5a32b5150937', 'Scott', 'Murphy', 'ronald602@icloud.com', '+1-525-528-3628', 'VERIFIED', '2026-01-21T19:26:50.828Z'),
  ('ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'b28d1f9e-6959-45b4-bdbf-e6841b5ce17d', 'Raymond', 'Campbell', 'anthony_reyes@devstudio.in', '+1-829-701-6635', 'UNDER_REVIEW', '2025-07-01T14:13:23.851Z'),
  ('fd1ebd31-d69d-4658-84ff-9831e44fa343', '97da2849-d73e-4b43-8a90-7d090402c802', 'Maria', 'Patel', 'eric.nguyen@enterprise.corp', '+1-564-674-4182', 'UNDER_REVIEW', '2025-12-08T12:14:38.710Z'),
  ('a3ac9252-d18c-4407-9c73-988df20dc814', '97da2849-d73e-4b43-8a90-7d090402c802', 'Christine', 'Hall', 'sramirez626@techstart.co', '+1-961-594-8724', 'REJECTED', '2025-09-16T03:29:38.831Z'),
  ('530894ff-bf3c-4148-afcb-cfcd9e58053b', '97da2849-d73e-4b43-8a90-7d090402c802', 'Stephen', 'Perez', 'katherine.lewis@outlook.com', '+1-945-975-4089', 'DOCS_SUBMITTED', '2025-07-07T06:08:36.263Z'),
  ('3529ebcd-bb34-463f-a8d5-efb238e6d109', '97da2849-d73e-4b43-8a90-7d090402c802', 'Susan', 'Stewart', 'frank.martin@outlook.com', '+1-392-950-9095', 'DOCS_SUBMITTED', '2025-11-30T16:00:34.405Z'),
  ('834b77f8-1e8a-4128-b533-7658717b2043', '97da2849-d73e-4b43-8a90-7d090402c802', 'Heather', 'James', 'shirley_flores@cloudops.net', '+1-357-757-8422', 'UNDER_REVIEW', '2025-10-19T15:46:34.586Z'),
  ('a9473572-7535-453c-86da-71922d386c97', 'b362a53a-e5c6-42d5-8bae-e39720bb4450', 'Nicholas', 'Nguyen', 'matthew929@techstart.co', '+1-833-713-2683', 'PENDING', '2026-04-16T02:07:00.075Z'),
  ('b7849d56-feb0-48e3-9064-dd90e5957cbd', '97da2849-d73e-4b43-8a90-7d090402c802', 'Charles', 'Martinez', 'rebeccal778@acme.io', '+1-933-706-7653', 'DOCS_SUBMITTED', '2026-04-03T22:42:12.279Z'),
  ('0c101477-1bf7-4761-b912-103bb636c127', '6dda104b-4dae-4e51-a374-4b8791cbe100', 'Kevin', 'Miller', 'william586@company.internal', '+1-532-530-1921', 'VERIFIED', '2025-09-28T19:41:15.662Z'),
  ('ef964b32-ae6f-42e5-a658-fc7021c80cbb', '97da2849-d73e-4b43-8a90-7d090402c802', 'Anna', 'Peterson', 'janett800@enterprise.corp', '+1-965-827-6066', 'PENDING', '2025-12-17T20:12:59.071Z'),
  ('ef9f42b8-1282-4ff8-8774-441f2712e68a', 'e658d9db-24f7-44ac-bb2d-e8717ea679b8', 'Kevin', 'Bailey', 'cynthia_nelson@outlook.com', '+1-928-823-7861', 'UNDER_REVIEW', '2026-02-22T16:39:52.156Z'),
  ('9b2fe05d-830c-4fc2-8534-f152333f45b3', '72d8de72-9c36-48f7-9db0-128acfdadd95', 'Edward', 'Gutierrez', 'susan.bennett@techstart.co', '+1-716-259-1767', 'PENDING', '2025-06-02T07:20:33.008Z'),
  ('5b251d54-b752-499b-b057-b1e9c98f30b1', '361f3399-8665-46b1-9aae-d7c27a63fe6e', 'Carolyn', 'Roberts', 'james_gray@gmail.com', '+1-943-531-2390', 'VERIFIED', '2026-01-08T15:54:20.793Z'),
  ('2ee0e54c-e8e2-4dfb-bce8-841df0b98a2a', '97da2849-d73e-4b43-8a90-7d090402c802', 'Eric', 'Taylor', 'william.rodriguez@proton.me', '+1-840-293-6746', 'PENDING', '2026-04-20T01:44:41.701Z'),
  ('0c34488f-aa69-471a-b20e-c308a7c1d62f', '361f3399-8665-46b1-9aae-d7c27a63fe6e', 'Stephen', 'Morgan', 'shirley_green@devstudio.in', '+1-391-743-7534', 'VERIFIED', '2026-03-31T02:33:46.904Z'),
  ('8dc3d903-ae48-45a1-8812-3d22b7509ab2', '700893a3-4bd8-4344-9aab-e1f6f210579e', 'Christine', 'Gonzalez', 'samuel_jones@acme.io', '+1-451-252-5352', 'UNDER_REVIEW', '2025-09-08T12:39:28.167Z'),
  ('f9c8ea2e-e06f-4787-885e-44c83b5a9e63', '97da2849-d73e-4b43-8a90-7d090402c802', 'Kimberly', 'Bailey', 'samuel_mitchell@gmail.com', '+1-653-921-5741', 'VERIFIED', '2025-08-04T08:20:31.144Z'),
  ('b764d16b-0ca6-4716-9ef4-d0eba0f2023f', 'b362a53a-e5c6-42d5-8bae-e39720bb4450', 'Anthony', 'Jones', 'mary742@cloudops.net', '+1-502-893-9571', 'VERIFIED', '2026-03-24T05:11:28.077Z'),
  ('18848462-bdaa-48a8-8131-5231e6ab7dd1', 'e658d9db-24f7-44ac-bb2d-e8717ea679b8', 'Jerry', 'Brooks', 'christopherc339@acme.io', '+1-603-421-7014', 'DOCS_SUBMITTED', '2025-12-18T20:44:21.106Z'),
  ('0371f539-0a22-44ba-b557-2d312449b335', '97da2849-d73e-4b43-8a90-7d090402c802', 'Jack', 'Scott', 'cmoore212@proton.me', '+1-980-343-4962', 'REJECTED', '2025-09-24T08:49:48.551Z'),
  ('6e0a9bfe-e3f5-4431-b72b-73d92de78622', '97da2849-d73e-4b43-8a90-7d090402c802', 'David', 'Edwards', 'ryan_williams@outlook.com', '+1-935-309-3127', 'PENDING', '2026-02-22T05:25:30.708Z'),
  ('0aef9393-8036-4bf0-a21a-180b77ffc83e', 'b28d1f9e-6959-45b4-bdbf-e6841b5ce17d', 'Carol', 'Rogers', 'cynthiaw274@cloudops.net', '+1-975-586-5840', 'VERIFIED', '2026-05-29T21:47:45.576Z'),
  ('02e8e63c-074c-470a-b42d-8bf5d0b1e42c', '97da2849-d73e-4b43-8a90-7d090402c802', 'Kimberly', 'James', 'dennise781@acme.io', '+1-681-336-5226', 'DOCS_SUBMITTED', '2026-05-02T07:40:59.791Z'),
  ('f03c2ed6-3f6f-4052-90e8-85a8eba7617b', '97da2849-d73e-4b43-8a90-7d090402c802', 'Julie', 'Watson', 'jeffrey730@gmail.com', '+1-402-723-5827', 'VERIFIED', '2025-12-12T03:28:35.282Z');

-- Table: payments (25 rows)
INSERT INTO "payments" ("id", "user_id", "tx_st_cd", "pay_mthd", "mrr_cents", "ip_orig", "created_at") VALUES
  ('7363f0aa-ae74-4308-b0d9-5721a120132b', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'REFUNDED', 'ACH', 217599, '29.6.143.108', '2025-06-28T18:28:07.285Z'),
  ('de3072f0-498c-4f58-8e0b-c9f82d902536', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'SETTLED', 'DEBIT_CARD', 78944, '41.79.221.116', '2025-08-30T05:21:12.866Z'),
  ('e7a3933d-599f-4a0e-99d7-883e6fecf173', 'fd1ebd31-d69d-4658-84ff-9831e44fa343', 'FAILED', 'DEBIT_CARD', 206826, '72.156.93.181', '2025-06-25T03:26:24.799Z'),
  ('aba3aae1-4ba6-4bc1-9f41-1be8590abdfe', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'INIT', 'WIRE', 202207, '97.27.211.94', '2025-12-06T17:47:44.435Z'),
  ('b11b960c-bab5-4452-982f-60516216c1fe', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'INIT', 'CREDIT_CARD', 75075, '189.191.152.82', '2025-10-25T06:49:19.146Z'),
  ('9d5b5fae-9f10-49f0-92fb-64ad7f164c8c', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'INIT', 'PAYPAL', 212478, '145.232.30.37', '2026-01-29T08:29:52.981Z'),
  ('271f8b40-d830-41da-a646-928223426c26', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'AUTH', 'APPLE_PAY', 26983, '183.48.122.65', '2026-02-21T09:55:58.514Z'),
  ('6d9e03cb-b3be-46d4-ab81-4dc39f5788dc', 'fd1ebd31-d69d-4658-84ff-9831e44fa343', 'INIT', 'CREDIT_CARD', 185284, '168.251.154.41', '2026-03-07T04:40:58.233Z'),
  ('5b16710b-6a0a-4591-83e8-1b56d05a0eb6', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'REFUNDED', 'CREDIT_CARD', 59423, '74.16.171.63', '2025-09-15T13:13:34.300Z'),
  ('82dbdfe2-4882-417d-9f2d-926549a2f540', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'REFUNDED', 'DEBIT_CARD', 93587, '165.15.232.71', '2026-01-09T22:07:30.591Z'),
  ('8c5e48eb-4c9e-4ec3-bd55-0f46364aa5a9', '530894ff-bf3c-4148-afcb-cfcd9e58053b', 'SETTLED', 'PAYPAL', 5171, '184.130.66.212', '2025-08-29T09:39:13.046Z'),
  ('03a59f77-d668-44c1-98d3-ac17f1433aed', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'FAILED', 'CREDIT_CARD', 27574, '90.51.224.183', '2026-05-28T12:06:05.474Z'),
  ('8323c66f-03a2-4ded-81ad-e15c26173a2e', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'AUTH', 'APPLE_PAY', 137472, '119.37.171.205', '2026-04-09T20:10:25.865Z'),
  ('a5cd35d3-fe3f-4c34-b101-f15dce81aae8', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'SETTLED', 'CREDIT_CARD', 145387, '36.83.179.98', '2026-03-31T03:23:39.740Z'),
  ('3f19100c-40fb-49ac-b039-dff53a8b8cf1', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'SETTLED', 'APPLE_PAY', 99694, '34.195.35.8', '2026-03-15T22:21:09.465Z'),
  ('a358b8b7-af5c-485b-a1e4-be78cf55a86d', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'AUTH', 'APPLE_PAY', 155379, '166.154.139.3', '2026-01-14T17:56:12.409Z'),
  ('0a5f63cd-e33d-45a3-bf79-d379d0196954', 'fd1ebd31-d69d-4658-84ff-9831e44fa343', 'INIT', 'DEBIT_CARD', 87679, '111.223.0.190', '2026-02-10T17:58:59.733Z'),
  ('799d0d51-4c4d-436e-ae77-d9e2218b5fd0', 'ac8fde98-6d40-4902-b232-6f7bdc4d540b', 'INIT', 'DEBIT_CARD', 93750, '24.134.129.216', '2025-10-21T16:08:28.499Z'),
  ('5fcccba8-4cb7-4cc9-8a76-4c996b566366', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'PENDING', 'APPLE_PAY', 132453, '110.178.1.197', '2026-01-23T03:33:21.779Z'),
  ('bfada495-477d-4f04-adc0-a8a7e4f2a776', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'AUTH', 'PAYPAL', 49561, '74.203.6.47', '2025-10-14T19:18:16.908Z'),
  ('76310bcf-29ef-48ed-97e3-9f5fb049ed17', 'a9473572-7535-453c-86da-71922d386c97', 'INIT', 'PAYPAL', 245126, '112.18.195.70', '2025-09-15T00:56:59.317Z'),
  ('a6651999-533a-48f6-8ce2-36c785655cf2', 'fd1ebd31-d69d-4658-84ff-9831e44fa343', 'CAPTURED', 'WIRE', 152298, '138.41.69.210', '2025-11-01T01:48:13.652Z'),
  ('d67cfa65-6688-4664-8143-30e3ffbf5561', 'fd1ebd31-d69d-4658-84ff-9831e44fa343', 'AUTH', 'PAYPAL', 12557, '43.124.80.168', '2025-06-24T08:33:57.925Z'),
  ('7a5f2700-ed7f-43cd-9af1-ac8d957a4c0e', '47c5b5f0-fb74-4454-b0b2-40c1b875a94c', 'AUTH', 'ACH', 192489, '73.197.63.107', '2025-11-30T11:11:59.746Z'),
  ('3420211b-c96d-4c28-8179-6b1930ed3c71', '3529ebcd-bb34-463f-a8d5-efb238e6d109', 'PENDING', 'ACH', 171289, '177.90.132.192', '2026-02-18T17:47:30.845Z');

-- Re-enable foreign key constraints and triggers
SET session_replication_role = 'origin';

COMMIT;
