# git-forge — Design Specification

## 1. Overview

git-forge is a self-hosted, GitHub-like Git repository host. It provides
repository browsing, issue tracking, branch and tag management, stash
operations, diffing, blame, forking, webhooks, and a command-line client,
backed by real Git checkouts on the local filesystem rather than a custom
object store.

## 2. Goals

- **Real Git underneath.** Every repository is a genuine Git working
  copy operated on with the standard `git` binary, so the on-disk state
  is never a proprietary format and remains usable with any standard Git
  tooling independent of this application.
- **Minimal-friction first use.** A freshly deployed instance with no
  accounts configured should be immediately usable via a guest identity,
  with account creation available but not mandatory for a single
  operator.
- **Both browser and terminal as first-class clients.** Every capability
  reachable from the web UI should also be reachable from the bundled
  command-line client using the same underlying API and authentication
  model.
- **Mountable behind a path prefix.** The entire application must be
  runnable either standalone or mounted under a URL prefix (as it is
  behind the shared portal) without any route needing prefix-awareness
  written into it individually.

## 3. Architecture

### 3.1 Request routing

The application's route table is defined against an Express `Router`
instance rather than the top-level application object. That router is
then mounted onto the real application under a single, environment-
configurable base path. This allows the entire route table to move
between being served at the domain root and being served under a prefix
without any individual route definition changing.

### 3.2 Authentication

Two independent authentication schemes are supported by a single
middleware:

| Scheme | Mechanism | Use case |
|---|---|---|
| Session | Signed session cookie, backed by a file-based session store | Browser access |
| Bearer token | Per-account token, or a fixed guest token when no accounts exist | Command-line client access |

Session state is persisted to disk (not held only in memory) so that
active sessions survive a server restart. Passwords are hashed with
bcrypt before storage; the raw password is never persisted.

### 3.3 Command-line client

A standalone script, independent of the server process, communicating
over plain HTTP using the bearer-token scheme above. Credentials are
cached locally between invocations so a user does not need to
re-authenticate on every command.

### 3.4 Repository operations

Most repository-mutating operations are performed through a Git wrapper
library that shells out to the real `git` binary, ensuring behavior
matches what a user would see running the same operation directly. A
small number of operations not covered by that wrapper's API — arbitrary
command execution against a repository, author-rewriting, and archive
export — invoke `git` directly as a subprocess.

### 3.5 Upstream synchronization

Repositories that were imported from, or configured with, a remote are
periodically synchronized in the background on a fixed interval,
independent of any user interaction, so that browsing a forked or
imported repository reflects reasonably current upstream state without
requiring a manual refresh. Synchronization can also be triggered
on-demand, for a single repository or for all eligible repositories at
once.

### 3.6 Import and seeding

Repositories may be imported directly from a public Git hosting provider
by owner and name, performed as a real clone operation with progress
tracked via the underlying process lifecycle. A separate, non-automatic
utility exists to bulk-populate an instance with a curated set of public
repositories and corresponding bot accounts, intended for demonstration
or testing purposes and not part of normal server operation.

## 4. Feature Surface

| Area | Capabilities |
|---|---|
| Repositories | Create, delete, browse tree/blob, upload files, export as archive, fork, clone, import |
| History | Diff, blame, commit graph, activity feed, contribution heatmap |
| Branching | List, create, checkout, delete branches; merge; tag management |
| Working state | Stash list, create, apply, drop |
| Collaboration | Issues (create, update, close), webhooks |
| Accounts | Self-service account creation (first account only, thereafter admin-managed), password change, CLI token regeneration, avatar |
| Language statistics | Per-repository language breakdown by file extension |

## 5. Data Model

All persistent state is stored as plain files rather than in a database:

| Store | Format | Contents |
|---|---|---|
| Repository data | Real Git checkouts | Repository content and history |
| Accounts | JSON file | Username, password hash, CLI token, creation timestamp |
| Sessions | File-backed store | Active browser sessions |
| Avatars | Cached image files | Generated or fetched avatar images |

## 6. Deployment

git-forge is one of the applications managed by the shared `install.sh`
installer described in the top-level `DESIGN_SPEC.md`. Its default
branch is not assumed to have any particular name by the installer's
update logic, which reads back whatever branch is actually checked out
rather than hardcoding an assumption.
