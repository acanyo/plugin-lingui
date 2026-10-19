package com.acanyo.halo.plugin.lingui.projectselection;

import io.swagger.v3.oas.annotations.media.Schema;

/** Project metadata suitable for a selector; saved documents and history stay private. */
public record ProjectOption(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String category,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1") int revision,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean embedEnabled
) {}
