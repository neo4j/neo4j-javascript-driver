/**
 * Copyright (c) 2002-2017 "Neo Technology,","
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Session from "./session";
import {Parameters} from "./statement-runner";

declare interface AuthToken {
  scheme: string;
  principal: string;
  credentials: string;
  realm?: string;
  parameters?: Parameters;
}

declare type EncryptionLevel = "ENCRYPTION_ON" | "ENCRYPTION_OFF";
declare type TrustStrategy =
  "TRUST_ALL_CERTIFICATES" |
  "TRUST_ON_FIRST_USE" |
  "TRUST_SIGNED_CERTIFICATES" |
  "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES" |
  "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES";

declare interface Config {
  encrypted?: boolean | EncryptionLevel;
  trust?: TrustStrategy;
  trustedCertificates?: string[];
  knownHosts?: string;
  connectionPoolSize?: number;
  maxTransactionRetryTime?: number;
}

declare type SessionMode = "READ" | "WRITE";

declare const READ: SessionMode;
declare const WRITE: SessionMode;

declare interface Driver {
  session(mode?: SessionMode, bookmark?: string): Session;

  close(): void;
}

export {Driver, READ, WRITE, AuthToken, Config, EncryptionLevel, TrustStrategy, SessionMode}

export default Driver;
