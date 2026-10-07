package com.cropcare.disease;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * A registered pesticide recommendation. Fill these only from official sources
 * (CIB&RC registration list, ICAR / state agricultural university package of practices).
 */
@Embeddable
public class ChemicalOption {

    @Column(name = "active_ingredient", length = 200)
    private String activeIngredient;

    /** As printed on the label / package of practices, e.g. "2.5 g per litre of water" */
    @Column(length = 200)
    private String dose;

    /** Days to wait between the last spray and harvest */
    @Column(name = "waiting_period_days")
    private Integer waitingPeriodDays;

    @Column(length = 500)
    private String note;

    @Column(length = 500)
    private String source;

    public String getActiveIngredient() {
        return activeIngredient;
    }

    public void setActiveIngredient(String activeIngredient) {
        this.activeIngredient = activeIngredient;
    }

    public String getDose() {
        return dose;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public Integer getWaitingPeriodDays() {
        return waitingPeriodDays;
    }

    public void setWaitingPeriodDays(Integer waitingPeriodDays) {
        this.waitingPeriodDays = waitingPeriodDays;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
