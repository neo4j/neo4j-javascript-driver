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

import Transaction from "../../../types/v1/transaction";

const dummy: any = null;

const tx: Transaction = dummy;

const isOpen: boolean = tx.isOpen();
console.log(isOpen);

const runResult1 = tx.run("RETURN 1");
runResult1.then(result => {
  result.records.forEach(record => {
    console.log(record);
  });
});

tx.commit().catch(error => {
  console.log(error);
});

tx.rollback().catch(error => {
  console.log(error);
});
