package com.cropcare.translation;

import java.util.List;

/** A machine translation service: Bhashini, or the AI service's own model. */
public interface Translator {

    /** Shown to users as "translated by ..." and stored with each cached translation. */
    String name();

    /** Configured and allowed to be used (says nothing about whether it is reachable right now). */
    boolean isAvailable();

    /** Translate texts, same order. Throws on any failure. */
    List<String> translate(List<String> texts, String source, String target);
}
