import skip, { ifEquals, ifEndsWith } from './skip'

const skippedTests = [
  skip(
    'Just for now',
    ifEndsWith('test_no_reset_on_clean_connection')
  ),
  skip(
    'Skipped because server doesn\'t support protocol 5.0 yet',
    ifEndsWith('neo4j.test_summary.TestSummary.test_protocol_version_information')
  ),
  skip(
    'Handle qid omission optmization can cause issues in nested queries',
    ifEquals('stub.optimizations.test_optimizations.TestOptimizations.test_uses_implicit_default_arguments'),
    ifEquals('stub.optimizations.test_optimizations.TestOptimizations.test_uses_implicit_default_arguments_multi_query'),
    ifEquals('stub.optimizations.test_optimizations.TestOptimizations.test_uses_implicit_default_arguments_multi_query_nested')
  ),
  skip(
    'Fail while enable Temporary::ResultKeys',
    ifEquals('neo4j.test_bookmarks.TestBookmarks.test_can_pass_bookmark_into_next_session'),
    ifEquals('neo4j.test_direct_driver.TestDirectDriver.test_multi_db_various_databases'),
    ifEquals('neo4j.test_session_run.TestSessionRun.test_iteration_smaller_than_fetch_size'),
    ifEquals('neo4j.test_summary.TestSummary.test_summary_counters_case_2'),
    ifEquals('neo4j.test_tx_func_run.TestTxFuncRun.test_tx_func_configuration'),
    ifEquals('neo4j.test_tx_run.TestTxRun.test_consume_after_commit'),
    ifEquals('neo4j.test_tx_run.TestTxRun.test_tx_configuration'),
    ifEquals('neo4j.test_tx_run.TestTxRun.test_interwoven_queries'),
    ifEquals('neo4j.test_tx_run.TestTxRun.test_parallel_queries')
  ),
  skip('Flacky because sometimes the connection is actually available',
    ifEndsWith('test_should_enforce_pool_size_per_cluster_member')
  ),
  skip(
    'Flaky in TeamCity',
    ifEndsWith('test_should_fail_when_writing_to_unexpectedly_interrupting_writers_on_run_using_tx_function'),
    ifEndsWith('test_should_read_successfully_from_reachable_db_after_trying_unreachable_db'),
    ifEndsWith('test_should_fail_when_reading_from_unexpectedly_interrupting_readers_using_tx_function')
  ),
  skip(
    'ResultSummary.notifications defaults to empty array instead of return null/undefined',
    ifEquals('stub.summary.test_summary.TestSummary.test_no_notifications'),
    ifEquals('neo4j.test_summary.TestSummary.test_no_notification_info')
  ),
  skip(
    'ResultSummary.plan defaults to empty array instead of return null/undefined',
    ifEquals('neo4j.test_summary.TestSummary.test_no_plan_info')
  ),
  skip(
    'Partial session iteration is not supported by the js driver',
    ifEquals('neo4j.test_session_run.TestSessionRun.test_partial_iteration'),
    ifEquals('neo4j.test_session_run.TestSessionRun.test_session_reuse'),
    ifEquals('neo4j.test_session_run.TestSessionRun.test_iteration_nested'),
    ifEquals('stub.iteration.test_iteration_session_run.TestIterationSessionRun.test_nested')
  ),
  skip(
    'Nested calls does not garauntee order in the records pulling',
    ifEquals('stub.iteration.test_iteration_tx_run.TestIterationTxRun.test_nested')
  ),
  skip(
    'The driver has no support domain_name_resolver',
    ifEndsWith('test_should_successfully_acquire_rt_when_router_ip_changes'),
    ifEndsWith(
      'test_should_request_rt_from_all_initial_routers_until_successful'
    )
  ),
  skip(
    'Driver is start to run tx_function before have a valid connection in hands',
    ifEndsWith(
      'test_should_retry_write_until_success_with_leader_shutdown_during_tx_using_tx_function'
    ),
    ifEndsWith(
      'test_should_retry_write_until_success_with_leader_change_using_tx_function'
    ),
    ifEndsWith('test_should_retry_on_auth_expired_on_begin_using_tx_function')
  ),
  skip(
    'Driver is creating a dedicated connection to check the MultiDBSupport',
    ifEndsWith(
      'test_should_successfully_check_if_support_for_multi_db_is_available'
    )
  ),
  skip(
    'Fails when runned with the full suite',
    ifEndsWith(
      '.test_should_revert_to_initial_router_if_known_router_throws_protocol_errors'
    )
  ),
  skip(
    'Keeps retrying on commit despite connection being dropped',
    ifEquals('stub.retry.test_retry.TestRetry.test_disconnect_on_commit')
  ),
  skip(
    'Wait clarification about verifyConnectivity behaviour when no reader connection is available',
    ifEndsWith(
      '.test_should_use_initial_router_for_discovery_when_others_unavailable'
    ),
    ifEndsWith('.test_should_successfully_get_routing_table_with_context')
  ),
  skip(
    'Driver is executing the second tx for the same session in a diferent server',
    ifEndsWith('test_should_pass_bookmark_from_tx_to_tx_using_tx_run')
  ),
  skip(
    'Driver resolves the address during the record fetch',
    ifEndsWith(
      'test_should_use_resolver_during_rediscovery_when_existing_routers_fail'
    )
  ),
  skip(
    'Needs to implement "domain_name_resolver_fn"',
    ifEndsWith(
      'test_should_request_rt_from_all_initial_routers_until_successful_on_unknown_failure'
    ),
    ifEndsWith(
      'test_should_request_rt_from_all_initial_routers_until_successful_on_authorization_expired'
    )
  ),
  skip(
    'Needs investigation. It is only failing in the RoutingV3 case',
    ifEndsWith(
      'RoutingV3.test_should_accept_routing_table_without_writers_and_then_rediscover'
    )
  ),
  skip(
    'Needs investigation',
    ifEndsWith(
      'test_should_fail_when_reading_from_unexpectedly_interrupting_reader_using_session_run'
    ),
    ifEquals(
      'stub.tx_run.test_tx_run.TestTxRun.test_rollback_tx_on_session_close_unfinished_result'
    ),
    ifEquals(
      'neo4j.sessionrun.TestSessionRun.test_partial_iteration'
    )
  ),
  skip(
    'Driver does not support mixing Result.subscribe with Result.then',
    ifEquals(
      'stub.iteration.test_result_list.TestResultList.test_tx_run_result_list_pulls_all_records_at_once_next_before_list'
    ),
    ifEquals(
      'stub.iteration.test_result_list.TestResultList.test_tx_func_result_list_pulls_all_records_at_once_next_before_list'
    ),
    ifEquals(
      'stub.iteration.test_result_list.TestResultList.test_session_run_result_list_pulls_all_records_at_once_next_before_list'
    )
  ),
  skip(
    'Driver (still) allows explicit managing of managed transaction',
    ifEquals('stub.tx_lifetime.test_tx_lifetime.TestTxLifetime.test_managed_tx_raises_tx_managed_exec')
  ),
  skip(
    'Flaky tests, requires investigation',
    ifEndsWith('.test_should_fail_when_reading_from_unexpectedly_interrupting_readers_using_tx_function')
  ),
  skip(
    'Flaky tests, requires investigation',
    ifEndsWith('.test_should_fail_when_writing_to_unexpectedly_interrupting_writers_using_tx_function')
  )
]

export default skippedTests
