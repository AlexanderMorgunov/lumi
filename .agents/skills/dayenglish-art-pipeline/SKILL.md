---
name: dayenglish-art-pipeline
description: Generate and integrate the game's non-pixel 2D backgrounds, props, characters and animation frames through Codex image tools. Use for game art tasks after a visual direction is selected, not UI layout or bootstrap.
---

# Layered 2D art and animation

Read [ART_DIRECTION](../../../docs/ART_DIRECTION.md), the approved art bible when it exists, and the affected scene. The owner's new direction replaces OxfordEnglish's PixelLab/pixel-art preference for this game. Reference screenshots establish inspiration, not permission to reuse another game's assets.

For raster creation/editing use the available imagegen skill/tool; inspect reference files before editing. Keep prompts, provider/date, source paths, rights/provenance and output versions in an asset manifest. Do not generate the production set before the first hero and room are reviewed in-engine.

Author separate far background, middle scenery, gameplay objects and foreground; specify camera perspective, lighting, palette, dimensions, alpha, depth and scroll factor. The camera may remain static for a puzzle room: parallax is a presentation choice, not mandatory continuous motion. Foreground must not obscure words or interaction targets. Use ordinary text rendering for words and UI.

For animation define actions, frame count/dimensions, frame duration, pivot, baseline and direction before generation. Do not assume square frames or automatically coherent generated motion. Inspect each frame and the loop at actual playback size; check limb identity, silhouette, alignment, seams and transparent edges. Store atlas metadata and owned source frames. Code can animate approved assets; a single generated still is not a validated animated character.

Validate decoded texture dimensions/memory, atlas padding, loading failures and visual quality at the real mobile scale. Keep originals separate from runtime exports. Confirm production assets and provenance before including them in the release; never bundle reference screenshots as game content.
