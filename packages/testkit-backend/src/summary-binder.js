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

function mapProfile (profile, child = false, binder) {
  const mapChild = (child) => mapProfile(child, true, binder)
  const obj = {
    args: binder.objectMemberBitIntToNumber(profile.arguments, true),
    dbHits: Number(profile.dbHits),
    identifiers: profile.identifiers,
    operatorType: profile.operatorType,
    rows: Number(profile.rows),
    children: profile.children ? profile.children.map(mapChild) : undefined
  }

  if (child) {
    return {
      ...obj,
      pageCacheHitRatio: profile.pageCacheHitRatio !== undefined ? Number(profile.pageCacheHitRatio) : undefined,
      pageCacheHits: profile.pageCacheHits !== undefined ? Number(profile.pageCacheHits) : undefined,
      pageCacheMisses: profile.pageCacheMisses !== undefined ? Number(profile.pageCacheMisses) : undefined,
      time: profile.time !== undefined ? Number(profile.time) : undefined
    }
  }
  return obj
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
    plan: mapPlan(summary.plan, binder),
    profile: mapProfile(summary.profile, false, binder),
    notifications: summary.notifications.map(mapNotification),
    gqlStatusObjects: summary.gqlStatusObjects.map(mapGqlStatusObject(binder))
  }
}
