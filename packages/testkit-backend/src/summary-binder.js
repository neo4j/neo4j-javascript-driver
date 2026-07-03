function mapPlan (plan, binder) {
  const mapChild = (child) => mapPlan(child, binder)
  return {
    operatorType: plan.operatorType,
    args: binder.objectMemberBitIntToNumber(plan.arguments, true),
    identifiers: plan.identifiers,
    children: plan.children ? plan.children.map(mapChild) : undefined
  }
}

function mapCounters (stats) {
  return {
    ...stats._stats,
    systemUpdates: stats.systemUpdates(),
    containsUpdates: stats.containsUpdates(),
    containsSystemUpdates: stats.containsSystemUpdates()
  }
}

function mapProfile (profile, binder) {
  const mapChild = (child) => mapProfile(child, binder)
  return {
    args: binder.objectMemberBitIntToNumber(profile.arguments, true),
    dbHits: profile.dbHits != null ? Number(profile.dbHits) : undefined,
    identifiers: profile.identifiers,
    operatorType: profile.operatorType,
    rows: profile.rows != null ? Number(profile.rows) : undefined,
    pageCacheHitRatio: profile.pageCacheHitRatio != null ? Number(profile.pageCacheHitRatio) : undefined,
    pageCacheHits: profile.pageCacheHits != null ? Number(profile.pageCacheHits) : undefined,
    pageCacheMisses: profile.pageCacheMisses != null ? Number(profile.pageCacheMisses) : undefined,
    time: profile.time != null ? Number(profile.time) : undefined,
    children: profile.children ? profile.children.map(mapChild) : undefined,
  }
}

function mapNotification (notification) {
  return {
    ...notification,
    rawCategory: notification.rawCategory || '',
    position: Object.keys(notification.position).length !== 0 ? notification.position : undefined
  }
}

function mapGqlStatusObject (binder) {
  return (gqlStatusObject) => {
    return {
      ...gqlStatusObject,
      position: gqlStatusObject.position || null,
      rawSeverity: gqlStatusObject.rawSeverity !== undefined ? gqlStatusObject.rawSeverity : null,
      rawClassification: gqlStatusObject.rawClassification !== undefined ? gqlStatusObject.rawClassification : null,
      diagnosticRecord: binder.objectToCypher(gqlStatusObject.diagnosticRecord)
    }
  }
}

export function nativeToTestkitSummary (summary, binder) {
  return {
    ...binder.objectMemberBitIntToNumber(summary),
    database: summary.database.name,
    query: {
      text: summary.query.text,
      parameters: binder.objectToCypher(summary.query.parameters)
    },
    serverInfo: {
      agent: summary.server.agent,
      protocolVersion: summary.server.protocolVersion.toString()
    },
    counters: mapCounters(summary.counters),
    plan: summary.plan ? mapPlan(summary.plan, binder) : null,
    profile: summary.profile ? mapProfile(summary.queryProfile, binder) : null,
    notifications: summary.notifications.map(mapNotification),
    gqlStatusObjects: summary.gqlStatusObjects.map(mapGqlStatusObject(binder))
  }
}
