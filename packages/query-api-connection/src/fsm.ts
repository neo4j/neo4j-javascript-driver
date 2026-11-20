/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

export type FSMTransition<S extends string = string, R extends unknown = unknown> = {
    nextState?: S,
    result?: R
}

export type FSMState<S extends string = string, E extends string = string> = {
    name: S, 
    events: Record<E, (input: unknown) => FSMTransition<S, unknown>>
}

export class FSM<S extends string = string, E extends string = string> {

    private current: FSMState<S, E>
    private readonly states:  FSMState<S, E>[] 

    constructor(...states: FSMState<S, E>[] ) {
        this.states = states
        this.current = states[0]
    }

    onEvent<R>(event: E, input: unknown): R {
        const { nextState, result } = this.current.events[event](input)
        this.transition(nextState)
        return result as R
    }

    private transition (stateName?: S) {
        if (stateName != null && stateName !== this.current.name) {
            const newState = this.states.find(st => st.name === stateName)
            if (newState == null) {
                throw new Error(`Invalid state transition. State ${stateName} does not exist`)

            }
            this.current = newState
        }
    }
}