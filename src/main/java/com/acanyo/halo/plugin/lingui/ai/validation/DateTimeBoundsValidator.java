package com.acanyo.halo.plugin.lingui.ai.validation;
import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
/** Validates calendar values and bounds for native date/time inputs. */
final class DateTimeBoundsValidator {
    private DateTimeBoundsValidator() {}
    static void validate(JsonNode node) {
        if (!node.path("component").asText().equals("DateTimeInput")) return;
        boolean date = node.path("enableDate").asBoolean();
        boolean time = node.path("enableTime").asBoolean();
        if (!date && !time) throw bad("日期时间组件至少启用日期或时间之一");
        String min = node.has("min") ? dateValue(node.path("min").asText(), date, time) : null;
        String max = node.has("max") ? dateValue(node.path("max").asText(), date, time) : null;
        if (min != null && max != null && min.compareTo(max) > 0) throw bad("日期时间最小值不能大于最大值");
    }

    private static String dateValue(String value, boolean date, boolean time) {
        try {
            if (date && !time) {
                if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
                return LocalDate.parse(value).toString();
            }
            if (!date) {
                if (!value.matches("([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?")) throw new IllegalArgumentException();
                return LocalTime.parse(value).format(DateTimeFormatter.ofPattern("HH:mm:ss"));
            }
            if (!value.matches("\\d{4}-\\d{2}-\\d{2}T([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?(Z|[+-](0\\d|1[0-4]):[0-5]\\d)?")) throw new IllegalArgumentException();
            LocalDateTime parsed = value.matches(".*(Z|[+-]\\d{2}:\\d{2})$")
                ? OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime()
                : LocalDateTime.parse(value);
            return parsed.format(DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss"));
        } catch (IllegalArgumentException | java.time.DateTimeException exception) {
            throw bad("日期时间范围格式无效");
        }
    }
}
