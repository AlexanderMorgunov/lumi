# Audio test fixtures

These JSON snapshots contain expected lesson text, selected voice metadata and audio provenance used by the existing unit tests. They were extracted from local authoring documents so a clean checkout can run tests and TypeScript without the ignored docs/ directory.

They contain no API keys or generated source audio. Runtime code uses the manifests in src/ and media in public/. Historical Qwen and segmented-recording records remain here only where regression tests explicitly inspect that history; they do not select the active provider.

After an approved content or audio update, review the affected fixture against the authoring output and the shipped manifest. Do not automatically overwrite expected data to make a failing test pass.
