/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
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

import Transaction from './transaction'

/**
 * Represents a transaction that is managed by the transaction executor.
 * 
 * @public
 */
class ManagedTransaction extends Transaction {
  
  /**
   * Commits the transaction and returns the result.
   *
   * After committing the transaction can no longer be used.
   *
   * @deprecated Commit should be done by returning from the transaction work.
   *
   * @returns {Promise<void>} An empty promise if committed successfully or error if any error happened during commit.
   */
  commit(): Promise<void> {
    return super.commit()
  }

  /**
   * Rollbacks the transaction.
   *
   * After rolling back, the transaction can no longer be used.
   *
   * @deprecated Rollback should be done by throwing or returning a rejected promise from the transaction work.
   *
   * @returns {Promise<void>} An empty promise if rolled back successfully or error if any error happened during
   * rollback.
   */
  rollback(): Promise<void> {
    return super.rollback()
  }

  /**
   * Closes the transaction
   *
   * This method will roll back the transaction if it is not already committed or rolled back.
   *
   * @deprecated Close should not be done in transaction work. See {@link ManagedTransaction#commit} and {@link ManagedTransaction#rollback}
   *
   * @returns {Promise<void>} An empty promise if closed successfully or error if any error happened during
   */
  close(): Promise<void> {
    return super.close()
  }
}

export default ManagedTransaction
