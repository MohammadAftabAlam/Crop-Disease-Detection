package com.cropcare.chat;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Checks on both sides of the model. The system instruction already tells the model the rules;
 * these checks hold even if the model ignores them (a "jailbreak" question, a mistake).
 */
final class ChatGuard {

    private ChatGuard() {
    }

    /** The longest answer shown; longer answers are cut at the last full sentence. */
    static final int MAX_ANSWER_CHARS = 1200;

    // "2 g per litre", "2.5 ml/L", "500 ml per acre", "0.1%"... and the Hindi forms
    private static final Pattern DOSE = Pattern.compile(
            "\\d+(?:[.,]\\d+)?\\s*(?:ml|g|gm|gms|grams?|kg|l|lit|litres?|liters?|ppm|%)\\s*(?:/|per|\\bin\\b|प्रति)\\s*"
                    + "(?:l\\b|lit|litre|liter|acre|ha\\b|hectare|tank|pump|bigha|लीटर|एकड़|हेक्टेयर|टंकी)"
                    + "|\\d+(?:[.,]\\d+)?\\s*(?:मिली|मिलीलीटर|ग्राम|किलो|किग्रा)\\s*(?:/|प्रति)?\\s*(?:लीटर|एकड़|हेक्टेयर|टंकी)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    // Common chemical pesticides (active ingredients) and brands sold in India. The app never
    // names one: which product is registered and safe is for the KVK / agriculture officer.
    private static final List<String> PESTICIDES = List.of(
            "mancozeb", "carbendazim", "propiconazole", "tebuconazole", "hexaconazole", "azoxystrobin",
            "copper oxychloride", "metalaxyl", "chlorothalonil", "tricyclazole", "isoprothiolane", "validamycin",
            "streptocycline", "streptomycin", "kasugamycin", "difenoconazole", "thiophanate", "captan", "zineb",
            "propineb", "cymoxanil", "dimethomorph", "imidacloprid", "thiamethoxam", "acetamiprid", "chlorpyrifos",
            "cypermethrin", "cyhalothrin", "deltamethrin", "emamectin", "chlorantraniliprole", "spinosad",
            "spinetoram", "flubendiamide", "fipronil", "cartap", "quinalphos", "profenofos", "monocrotophos",
            "dimethoate", "malathion", "abamectin", "dicofol", "propargite", "fenpyroximate", "spiromesifen",
            "carbofuran", "phorate", "novaluron", "indoxacarb", "glyphosate", "paraquat", "atrazine",
            "bavistin", "blitox", "ridomil", "dithane", "coragen", "confidor", "nativo", "amistar",
            "मैंकोजेब", "कार्बेन्डाजिम", "इमिडाक्लोप्रिड", "क्लोरपाइरीफॉस", "साइपरमेथ्रिन", "प्रोपिकोनाज़ोल");

    static final String OFF_TOPIC_EN = "I can only answer questions about this scan: the crop, the diagnosis and what to do next.";
    static final String OFF_TOPIC_HI = "मैं केवल इस जाँच से जुड़े सवालों के जवाब दे सकता हूँ: फसल, रोग की पहचान और आगे क्या करें।";
    static final String NO_CHEMICALS_EN = "I can't suggest pesticide names or doses. Your Krishi Vigyan Kendra or agriculture officer "
            + "can tell you a registered product and the right dose for your crop; always follow the label.";
    static final String NO_CHEMICALS_HI = "मैं कीटनाशक का नाम या मात्रा नहीं बता सकता। आपकी फसल के लिए पंजीकृत दवा और सही मात्रा "
            + "आपका कृषि विज्ञान केंद्र या कृषि अधिकारी बताएगा; हमेशा लेबल के अनुसार ही उपयोग करें।";

    /** Cleans the farmer's question; null if nothing is left. */
    static String cleanQuestion(String question) {
        if (question == null) {
            return null;
        }
        String cleaned = question.replaceAll("[\\p{Cntrl}&&[^\\n]]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    /** True when the answer names a chemical pesticide or gives a dose. */
    static boolean mentionsChemicals(String answer) {
        if (answer == null) {
            return false;
        }
        String lower = answer.toLowerCase(Locale.ROOT);
        return DOSE.matcher(answer).find() || PESTICIDES.stream().anyMatch(lower::contains);
    }

    static String trim(String answer) {
        String text = answer.strip();
        if (text.length() <= MAX_ANSWER_CHARS) {
            return text;
        }
        String cut = text.substring(0, MAX_ANSWER_CHARS);
        int end = Math.max(Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("। ")), cut.lastIndexOf('\n'));
        return (end > MAX_ANSWER_CHARS / 2 ? cut.substring(0, end + 1) : cut) + " …";
    }

    static String offTopic(String language) {
        return "hi".equals(language) ? OFF_TOPIC_HI : OFF_TOPIC_EN;
    }

    static String noChemicals(String language) {
        return "hi".equals(language) ? NO_CHEMICALS_HI : NO_CHEMICALS_EN;
    }
}
