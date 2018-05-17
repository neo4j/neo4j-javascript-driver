/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import Transaction from "../../../types/v1/transaction";
import Record from "../../../types/v1/record";
import Result, {StatementResult} from "../../../types/v1/result";
import ResultSummary from "../../../types/v1/result-summary";

const dummy: any = null;

const tx: Transaction = dummy;

const isOpen: boolean = tx.isOpen();
console.log(isOpen);

const result1: Result = tx.run("RETURN 1");
result1.then((res: StatementResult) => {
  const records: Record[] = res.records;
  const summary: ResultSummary = res.summary;
  console.log(records);
  console.log(summary);
}).catch((error: Error) => {
  console.log(error);
});

const result2: Result = tx.run("RETURN 2");
result2.subscribe({});
result2.subscribe({
  onNext: (record: Record) => console.log(record)
});
result2.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
});
result2.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
});

const result3: Result = tx.run("RETURN $value", {value: "42"});
result3.then((res: StatementResult) => {
  const records: Record[] = res.records;
  const summary: ResultSummary = res.summary;
  console.log(records);
  console.log(summary);
}).catch((error: Error) => {
  console.log(error);
});

const result4: Result = tx.run("RETURN $value", {value: "42"});
result4.subscribe({});
result4.subscribe({
  onNext: (record: Record) => console.log(record)
});
result4.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
});
result4.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
});

const result5: Result = tx.run({text: "RETURN 1"});
result5.then((res: StatementResult) => {
  const records: Record[] = res.records;
  const summary: ResultSummary = res.summary;
  console.log(records);
  console.log(summary);
}).catch((error: Error) => {
  console.log(error);
});

const result6: Result = tx.run({text: "RETURN 1"});
result6.subscribe({});
result6.subscribe({
  onNext: (record: Record) => console.log(record)
});
result6.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
});
result6.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
});

const result7: Result = tx.run({text: "RETURN $value", parameters: {value: 42}});
result7.then((res: StatementResult) => {
  const records: Record[] = res.records;
  const summary: ResultSummary = res.summary;
  console.log(records);
  console.log(summary);
}).catch((error: Error) => {
  console.log(error);
});

const result8: Result = tx.run({text: "RETURN $value", parameters: {value: 42}});
result8.subscribe({});
result8.subscribe({
  onNext: (record: Record) => console.log(record)
});
result8.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error)
});
result8.subscribe({
  onNext: (record: Record) => console.log(record),
  onError: (error: Error) => console.log(error),
  onCompleted: (summary: ResultSummary) => console.log(summary)
});

tx.commit().then((res: StatementResult) => {
  console.log(res);
}).catch((error: Error) => {
  console.log(error);
});

tx.rollback().then((res: StatementResult) => {
  console.log(res);
}).catch((error: Error) => {
  console.log(error);
});
