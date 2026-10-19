# Code Architecture & Modularity

- Keep each module, class, and function focused on one well-defined responsibility and one reason to change. Split distinct features into separate modules.
- Organize files in clearly named directories that reflect their domain, such as `auth/`, `services/`, `utils/`, and `models/`.
- Keep modules cohesive and loosely coupled. Prefer explicit interfaces and dependency injection over hidden shared state.
- Extract shared logic when it reduces actual complexity or enables stable reuse. Do not add abstractions solely to remove minor duplication.
- Prefer readable, straightforward code over clever or overly concise implementations.

# Plugin Packaging & Versions

- Before every build that generates a new deliverable plugin JAR, increment the plugin version in `gradle.properties`; never deliver a new package under the previous package's version.
- For a release candidate version, increment the RC sequence by default, for example `1.0.2-rc1` to `1.0.2-rc2`, unless the user specifies a different version.
- Update the current plugin version stated in `README.md` to match `gradle.properties` before packaging.
- Apply these version changes directly to the existing version files. Do not change the build mechanism or production code solely to automate version increments.
