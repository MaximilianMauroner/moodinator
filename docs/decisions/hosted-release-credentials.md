# Hosted release credential boundaries

The release pipeline separates project checks from credentials. A child environment
filter alone cannot isolate hostile tests from a same-user parent's environment or
key file. Therefore checks run on a separate runner with read-only repository
permission and no Expo, Play, or write-capable GitHub token.

The checked main SHA is an explicit output. Before reservation, the release runner
fetches main and requires exact equality with that SHA and its own checkout. A moved
main fails closed; no success flag bypasses this source gate.

The build runner installs locked dependencies without lifecycle scripts before
release credentials are used, checks tools/resources, and reserves with the GitHub
state token only in the ledger operation. EAS runs with Expo authentication but no
GitHub write or Play credentials. It necessarily trusts application build code with
Expo signing access. The upload runner is separate: it executes no project package
installation or tests, verifies both artifacts again, creates the Play file only
for upload, and finalizes the ledger. Normal failure finishes failed; cancellation
leaves an active reservation for explicit reconciliation.

A single job with scrubbed child environments was rejected because same-user tests
can still read parent credentials or retain a process into a later step. Splitting
every ledger call into another job adds resource/setup races and does not improve
isolated project checks. Credential scope follows each actual operation. Local
manual builds preserve their existing trusted-host contract with narrowed child
environments; they do not claim isolation from hostile code under the same user.
