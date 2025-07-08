import { Rule, rulesRegistry } from './mapping.highlevel.ts'
import { rule } from './mapping.rulesfactories.ts'

function booleanProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asBoolean(config)
        });
    }
}

function stringProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asString(config)
        });
    }
}

function numberProperty(config?: Rule & { acceptBigInt?: boolean }) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asNumber(config)
        });
    }
}

function bigIntProperty(config?: Rule & { acceptNumber?: boolean }) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asBigInt(config)
        });
    }
}

function nodeProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asNode(config)
        });
    }
}

function relationshipProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asRelationship(config)
        });
    }
}

function pathProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asPath(config)
        });
    }
}

function pointProperty(config?: Rule) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asPoint(config)
        });
    }
}

function durationProperty(config?: Rule & { stringify?: boolean }) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asDuration(config)
        });
    }
}

function listProperty(config?: Rule & { apply?: Rule }) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = rule.asList({ apply: {...rules[context.name] }, ...config})
        });
    }
}

function optionalProperty() {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = { optional: true, ...rules[context.name] }
        });
    }
}

function mapPropertyFromName(name: string) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = { from: name, ...rules[context.name] }
        });
    }
}

function convertPropertyToType(type: any) {
    return (_: any, context: any) => {
        context.addInitializer(function () {
            let constructorName = this.constructor.name
            if(rulesRegistry[constructorName] === undefined) {
                rulesRegistry[constructorName] = {}
            }
            const rules = rulesRegistry[constructorName]
            rules[context.name] = { convert: (node) => node.as(type), ...rules[context.name] }
        });
    }
}

const forExport = {
    booleanProperty,
    stringProperty,
    numberProperty,
    bigIntProperty,
    nodeProperty,
    relationshipProperty,
    pathProperty,
    pointProperty,
    durationProperty,
    listProperty,
    optionalProperty,
    mapPropertyFromName,
    convertPropertyToType
}

export default forExport