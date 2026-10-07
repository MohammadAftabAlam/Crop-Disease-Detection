package com.cropcare.disease;

import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cropcare.common.ApiException;

@Service
@Transactional(readOnly = true)
public class DiseaseService {

    private final DiseaseRepository diseases;

    public DiseaseService(DiseaseRepository diseases) {
        this.diseases = diseases;
    }

    public List<DiseaseDto> findAll() {
        return toDtos(diseases.findAllByOrderByCropAscDiseaseNameAsc());
    }

    public List<DiseaseDto> search(String query) {
        if (query == null || query.isBlank()) {
            return findAll();
        }
        String text = query.trim();
        return toDtos(diseases
                .findByCropContainingIgnoreCaseOrDiseaseNameContainingIgnoreCaseOrderByCropAscDiseaseNameAsc(text, text));
    }

    public List<DiseaseDto> findByCrop(String crop) {
        return toDtos(diseases.findByCropIgnoreCaseOrderByDiseaseNameAsc(crop));
    }

    public DiseaseDto findById(Long id) {
        return diseases.findById(id)
                .map(DiseaseDto::from)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Disease not found"));
    }

    /** Library entry for a model class id such as "tomato__late_blight". */
    public Optional<DiseaseDto> findByCode(String code) {
        return code == null ? Optional.empty() : diseases.findByCode(code).map(DiseaseDto::from);
    }

    private static List<DiseaseDto> toDtos(List<Disease> list) {
        return list.stream().map(DiseaseDto::from).toList();
    }
}
