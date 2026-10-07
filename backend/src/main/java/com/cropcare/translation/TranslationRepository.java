package com.cropcare.translation;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TranslationRepository extends JpaRepository<Translation, Long> {

    List<Translation> findByLanguageAndSourceHashIn(String language, Collection<String> sourceHashes);
}
