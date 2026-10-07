package com.cropcare.prediction;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * @param correct       was the diagnosis right?
 * @param actualClassId if not, the real disease code (e.g. "tomato__early_blight"), or "other" / null if unknown
 */
public record FeedbackRequest(
        @NotNull(message = "Please say whether the diagnosis was correct.") Boolean correct,
        @Size(max = 80) String actualClassId,
        @Size(max = 500, message = "Comment must be 500 characters or less.") String comment) {
}
