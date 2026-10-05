package com.cropcare.disease;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DiseaseRepository extends JpaRepository<Disease, Long> {

    List<Disease> findAllByOrderByCropAscDiseaseNameAsc();

    List<Disease> findByCropIgnoreCaseOrderByDiseaseNameAsc(String crop);

    /** "Containing" makes Spring Data escape % and _ in the search text, so user input is safe. */
    List<Disease> findByCropContainingIgnoreCaseOrDiseaseNameContainingIgnoreCaseOrderByCropAscDiseaseNameAsc(
            String crop, String diseaseName);

    Optional<Disease> findByCode(String code);

    Optional<Disease> findFirstByCropIgnoreCaseAndDiseaseNameIgnoreCase(String crop, String diseaseName);
}
