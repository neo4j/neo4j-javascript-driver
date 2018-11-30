## Guidelines

Firstly, if you are an Enterprise customer, you might want to head over to our [Customer Support Portal](http://support.neo4j.com/).

If you think you might have **hit a bug** in our software (it happens occasionally!) or you have specific **feature request** then use the issue feature on the relevant GitHub repository.
Check first though as someone else may have already raised something similar.

If you simply want to get started or have a question on how to use a particular feature, drop a line to the [mailing list](https://groups.google.com/forum/#!forum/neo4j), ask a question in [Slack](http://neo4j.com/slack), or [tweet](https://twitter.com/neo4j) us.
[StackOverflow](http://stackoverflow.com/questions/tagged/neo4j) also hosts a ton of questions and might already have a discussion around your problem.
Make sure you have a look there too.

If you want to make a feature request then there is no guideline, so feel free to stop reading and open an issue. 
If you have a bug report however, please continue reading.  
To help us understand your issue, please specify important details, primarily:

- Neo4j version: Community/Enterprise X.Y.Z
- Neo4j Mode: Single instance/HA cluster with X members/Casual cluster with X core Y read-replica
- Driver version: X lanaguage driver X.Y.Z (If you use some other library that wraps around this driver, you might want to raise an issue there first)
- Operating system: (for example Windows 95/Ubuntu 16.04 on AWS)
- **Steps to reproduce**
- Expected behavior
- Actual behavior

Additionally, include (as appropriate) log-files, stacktraces, and other debug output.
Always check the server logs too to see if there is any stacktrace related to the driver error.

## Example bug report

I got connection reset by peer errors.

**Neo4j Version:** 3.4.10  
**Neo4j Mode**: Single instance  
**Driver version**: JS driver 1.7.1  
**Operating System:** Ubuntu 15.10 on AWS  

### Steps to reproduce
1. Start a server on AWS
2. Run some query with the driver
3. Put the driver idle for 2h
4. Run another query
### Expected behavior
The query shall run successfully
### Actual behavior
The client failed to run the query with an `connection reset by peer` stacktrace.  
*attach the stachtrace*  
Meanwhile, on the server log I found this stacktrace that happens at the same time when the driver failed.  
*attach the stacktrace*  
