package com.cropcare.disease;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "diseases", uniqueConstraints = @UniqueConstraint(columnNames = { "crop", "disease_name" }))
public class Disease {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Same id the AI service returns, e.g. "tomato__late_blight" (ai-service/configs/taxonomy.yaml). */
    @Column(unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 50)
    private String crop;

    @Column(name = "disease_name", nullable = false, length = 100)
    private String diseaseName;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(length = 300)
    private String pathogen;

    @Column(name = "favourable_conditions", length = 1000)
    private String favourableConditions;

    @ElementCollection
    @CollectionTable(name = "disease_symptoms", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "item", length = 500)
    private List<String> symptoms = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_causes", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "item", length = 500)
    private List<String> causes = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_remedies", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "item", length = 500)
    private List<String> remedies = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_prevention", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "item", length = 500)
    private List<String> prevention = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_organic_control", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "item", length = 500)
    private List<String> organicControl = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_chemical_control", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    private List<ChemicalOption> chemicalControl = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "disease_sources", joinColumns = @JoinColumn(name = "disease_id"))
    @OrderColumn(name = "item_order")
    private List<SourceRef> sources = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getPathogen() {
        return pathogen;
    }

    public void setPathogen(String pathogen) {
        this.pathogen = pathogen;
    }

    public String getFavourableConditions() {
        return favourableConditions;
    }

    public void setFavourableConditions(String favourableConditions) {
        this.favourableConditions = favourableConditions;
    }

    public List<String> getOrganicControl() {
        return organicControl;
    }

    public void setOrganicControl(List<String> organicControl) {
        this.organicControl = new ArrayList<>(organicControl);
    }

    public List<ChemicalOption> getChemicalControl() {
        return chemicalControl;
    }

    public void setChemicalControl(List<ChemicalOption> chemicalControl) {
        this.chemicalControl = new ArrayList<>(chemicalControl);
    }

    public List<SourceRef> getSources() {
        return sources;
    }

    public void setSources(List<SourceRef> sources) {
        this.sources = new ArrayList<>(sources);
    }

    public String getCrop() {
        return crop;
    }

    public void setCrop(String crop) {
        this.crop = crop;
    }

    public String getDiseaseName() {
        return diseaseName;
    }

    public void setDiseaseName(String diseaseName) {
        this.diseaseName = diseaseName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<String> getSymptoms() {
        return symptoms;
    }

    public void setSymptoms(List<String> symptoms) {
        this.symptoms = new ArrayList<>(symptoms);
    }

    public List<String> getCauses() {
        return causes;
    }

    public void setCauses(List<String> causes) {
        this.causes = new ArrayList<>(causes);
    }

    public List<String> getRemedies() {
        return remedies;
    }

    public void setRemedies(List<String> remedies) {
        this.remedies = new ArrayList<>(remedies);
    }

    public List<String> getPrevention() {
        return prevention;
    }

    public void setPrevention(List<String> prevention) {
        this.prevention = new ArrayList<>(prevention);
    }
}
