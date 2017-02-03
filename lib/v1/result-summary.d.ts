import Integer, { int, isInt } from "./integer";

declare class ResultSummary {
  statement: {text: string, parameters: { [index: string]: any }};
  statementType: string;
  counters: StatementStatistic;
  //for backwards compatibility, remove in future version
  updateStatistics: StatementStatistic;
  plan: Plan;
  profile: ProfiledPlan;
  notifications: Notification[];
  server: ServerInfo;
  resultConsumedAfter: any | undefined;
  resultAvailableAfter: any | undefined;

  constructor(statement: string, parameters?: { [index: string]: any }, metadata?: { [index: string]: any })

  protected _buildNotifications(notifications: any): Notification[];
  hasPlan(): boolean;
  hasProfile(): boolean;
}

declare class Plan {
  operatorType: any;
  identifiers: any;
  arguments: any;
  children: Plan[];
  constructor(plan: Object)
}

declare class ProfiledPlan {
  operatorType: any;
  identifiers: any;
  arguments: any;
  dbhits: Integer;
  rows: Integer;
  children: Plan[];
  constructor(plan: Object)
}

interface Statistics {
  nodesCreated?: Integer;
  nodesDeleted?: Integer;
  relationshipsCreated?: Integer;
  relationshipsDeleted?: Integer;
  propertiesSet?: Integer;
  labelsAdded?: Integer;
  labelsRemoved?: Integer;
  indexesAdded?: Integer;
  indexesRemoved?: Integer;
  constraintsAdded?: Integer;
  constraintsRemoved?: Integer;
}

declare class StatementStatistic {
  protected _stats: Statistics;

  constructor(statistics: Statistics);

  containsUpdates(): boolean;

  nodesCreated(): Integer;
  nodesDeleted(): Integer;
  relationshipsCreated(): Integer;
  relationshipsDeleted(): Integer;
  propertiesSet(): Integer;
  labelsAdded(): Integer;
  labelsRemoved(): Integer;
  indexesAdded(): Integer;
  indexesRemoved(): Integer;
  constraintsAdded(): Integer;
  constraintsRemoved(): Integer;
}

declare interface NotificationPosition {
  offset: Integer;
  line: Integer;
  column: Integer;
}

declare interface NotificationStructure {
  code: any;
  title: string;
  description: string;
  severity: string;
  position: NotificationPosition;
}

declare class Notification implements Partial<NotificationStructure> {
  constructor(notification: NotificationStructure);

  _constructPosition(pos: NotificationPosition): NotificationPosition;
}

declare class ServerInfo {
  address: string;
  version: string;

  constructor(serverMeta: { address: string, version: string });
}

declare const statementType: {
  READ_ONLY: "r";
  READ_WRITE: "rw";
  WRITE_ONLY: "w";
  SCHEMA_WRITE: "s";
};

export { statementType }

export default ResultSummary;
