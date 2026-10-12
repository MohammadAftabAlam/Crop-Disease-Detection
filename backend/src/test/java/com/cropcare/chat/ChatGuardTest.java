package com.cropcare.chat;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatGuardTest {

    @Test
    void findsPesticideNamesAndDosesInEnglishAndHindi() {
        assertThat(ChatGuard.mentionsChemicals("Spray Imidacloprid on the whorl")).isTrue();
        assertThat(ChatGuard.mentionsChemicals("Use 2 g per litre of water")).isTrue();
        assertThat(ChatGuard.mentionsChemicals("mix 2.5 ml/L")).isTrue();
        assertThat(ChatGuard.mentionsChemicals("apply 500 ml per acre")).isTrue();
        assertThat(ChatGuard.mentionsChemicals("2 ग्राम प्रति लीटर पानी में")).isTrue();
        assertThat(ChatGuard.mentionsChemicals("इमिडाक्लोप्रिड का छिड़काव करें")).isTrue();
    }

    @Test
    void leavesOrdinaryAdviceAlone() {
        assertThat(ChatGuard.mentionsChemicals("Remove infected leaves within 2-3 days.")).isFalse();
        assertThat(ChatGuard.mentionsChemicals("Call 1800-180-1551 or visit your KVK.")).isFalse();
        assertThat(ChatGuard.mentionsChemicals("About 20% of the leaf area is affected.")).isFalse();
        assertThat(ChatGuard.mentionsChemicals("Spray a neem oil formulation following the label.")).isFalse();
        assertThat(ChatGuard.mentionsChemicals("संक्रमित पत्तियां 2-3 दिनों में हटा दें।")).isFalse();
    }

    @Test
    void cleansQuestionsAndCutsLongAnswersAtASentence() {
        assertThat(ChatGuard.cleanQuestion("  Will\tit   spread? \u0007 ")).isEqualTo("Will it spread?");
        assertThat(ChatGuard.cleanQuestion("   ")).isNull();
        String longAnswer = "This is one sentence. ".repeat(100);
        String cut = ChatGuard.trim(longAnswer);
        assertThat(cut.length()).isLessThanOrEqualTo(ChatGuard.MAX_ANSWER_CHARS + 2);
        assertThat(cut).endsWith(". …");
    }
}
