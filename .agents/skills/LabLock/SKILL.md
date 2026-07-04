```markdown
# LabLock Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the LabLock TypeScript codebase. You'll learn about file organization, code style, commit message conventions, and how to write and run tests. This guide is ideal for contributors seeking to maintain consistency and quality in the LabLock project.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example: `user-service.ts`, `lock-manager.test.ts`

### Import Style
- Use **relative imports** for referencing other files and modules.
  - Example:
    ```typescript
    import { LockManager } from './lock-manager';
    ```

### Export Style
- Mixed usage of **named** and **default exports**.
  - Named export example:
    ```typescript
    export function acquireLock() { ... }
    ```
  - Default export example:
    ```typescript
    export default LockManager;
    ```

### Commit Messages
- Use **Conventional Commits** with the following prefixes:
  - `feat`: New features
  - `fix`: Bug fixes
  - `chore`: Maintenance tasks
  - `docs`: Documentation changes
- Keep commit messages concise (average ~50 characters).
  - Example:
    ```
    feat: add lock expiration support
    fix: correct lock release timing
    ```

## Workflows

### Creating a Feature
**Trigger:** When adding a new feature  
**Command:** `/create-feature`

1. Create a new branch:  
   `git checkout -b feat/short-description`
2. Implement the feature in a new or existing file (use kebab-case).
3. Write or update tests in a corresponding `.test.ts` file.
4. Commit your changes using the `feat:` prefix.
5. Push your branch and open a pull request.

### Fixing a Bug
**Trigger:** When fixing a bug  
**Command:** `/fix-bug`

1. Create a new branch:  
   `git checkout -b fix/short-description`
2. Locate and fix the bug in the relevant file.
3. Add or update tests to cover the fix.
4. Commit your changes using the `fix:` prefix.
5. Push your branch and open a pull request.

### Updating Documentation
**Trigger:** When improving or updating documentation  
**Command:** `/update-docs`

1. Edit or add documentation files as needed.
2. Commit your changes using the `docs:` prefix.
3. Push your branch and open a pull request.

### Maintenance Tasks
**Trigger:** For code cleanup, dependency updates, or non-feature changes  
**Command:** `/chore-task`

1. Make the necessary maintenance changes.
2. Commit using the `chore:` prefix.
3. Push your branch and open a pull request.

## Testing Patterns

- Test files use the `.test.ts` suffix and are placed alongside or near the code they test.
  - Example: `lock-manager.test.ts`
- The specific test framework is not specified; check existing tests for patterns.
- Example test file structure:
  ```typescript
  import { acquireLock } from './lock-manager';

  describe('acquireLock', () => {
    it('should acquire a lock', () => {
      // test implementation
    });
  });
  ```
- Run tests using the project's test script or your chosen TypeScript test runner.

## Commands
| Command           | Purpose                                |
|-------------------|----------------------------------------|
| /create-feature   | Start a new feature implementation     |
| /fix-bug          | Begin work on a bug fix                |
| /update-docs      | Update or add documentation            |
| /chore-task       | Perform maintenance or cleanup tasks   |
```
