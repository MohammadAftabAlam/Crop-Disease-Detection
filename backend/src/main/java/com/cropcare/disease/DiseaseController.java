package com.cropcare.disease;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/diseases")
public class DiseaseController {

    private final DiseaseService diseaseService;

    public DiseaseController(DiseaseService diseaseService) {
        this.diseaseService = diseaseService;
    }

    @GetMapping
    public Map<String, Object> getAll() {
        return Map.of("success", true, "diseases", diseaseService.findAll());
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(name = "q", required = false) String query) {
        return Map.of("success", true, "diseases", diseaseService.search(query));
    }

    @GetMapping("/crop/{crop}")
    public Map<String, Object> getByCrop(@PathVariable String crop) {
        return Map.of("success", true, "diseases", diseaseService.findByCrop(crop));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getById(@PathVariable Long id) {
        return Map.of("success", true, "disease", diseaseService.findById(id));
    }
}
