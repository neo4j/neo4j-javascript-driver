import { objectToCypher, objectMemberBitIntToNumber } from './cypher-native-binders.js'

function mapPlan(plan) {
  return {
    operatorType: plan.operatorType,
    args: plan.arguments,
    identifiers: plan.identifiers,
    children: plan.children ? plan.children.map(mapPlan) : undefined
  }
}

function mapCounters(stats) {
  return {
    ...stats._stats,
    systemUpdates: stats.systemUpdates(),
    containsUpdates: stats.containsUpdates(),
    containsSystemUpdates: stats.containsSystemUpdates()
  }
}

function mapProfile(profile, child=false) {
  const mapChild = (child) => mapProfile(child, true)
  const obj = {
    args: objectMemberBitIntToNumber(profile.arguments),
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
      time: profile.time !== undefined ? Number(profile.time) : undefined,
    }
  }
  return obj
}

function mapNotification(notification) {
  return {
    ...notification,
    position: Object.keys(notification.position).length !== 0 ? notification.position : undefined,
  }
}

export function nativeToTestkitSummary (summary) {
  return {
    ...objectMemberBitIntToNumber(summary),
    database: summary.database.name,
    query: {
      text: summary.query.text,
      parameters: objectToCypher(summary.query.parameters)
    },
    serverInfo: {
      agent: summary.server.agent,
      protocolVersion: summary.server.protocolVersion.toFixed(1) 
    },
    counters: mapCounters(summary.counters),
    plan: mapPlan(summary.plan),
    profile: mapProfile(summary.profile),
    notifications: summary.notifications.map(mapNotification)
  }
}
