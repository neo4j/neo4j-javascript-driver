import Integer, { int, isInt } from "./integer";

declare class ResultSummary {
  constructor(statement: string, parameters: Object, metadata: Object)

  _buildNotifications( notifications: any ): Notification[];

  hasPlan(): boolean;

  hasProfile(): boolean;
}

declare class Plan {
  operatorType: any;
  identifiers: any;
  arguments: any;
  children: Plan[];
  constructor( plan: Object )
}

declare class ProfiledPlan {
  operatorType: any;
  identifiers: any;
  arguments: any;
  dbhits: Integer;
  rows: Integer;
  children: Plan[];
  constructor( plan: Object )
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
  _stats: Statistics;
  constructor( statistics: Statistics )

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

declare class Notification {
  code: any;
  title: string;
  description: string;
  severity: string;
  position: any;

  constructor( notification: {
    code: any,
    title: string,
    description: string,
    severity: string,
    position: any } )

  _constructPosition( pos ): {
    offset: Integer,
    line: Integer,
    column: Integer,
  } | {}
}

declare class ServerInfo {
  address: string;
  version: string;

  constructor( serverMeta: {address: string, version: string} )
}

declare type statementType = {
  READ_ONLY: "r",
  READ_WRITE: "rw",
  WRITE_ONLY: "w",
  SCHEMA_WRITE: "s"
};

export { statementType }

export default ResultSummary;
