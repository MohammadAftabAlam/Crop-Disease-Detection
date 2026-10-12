package com.cropcare.chat;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByPredictionIdOrderByIdAsc(Long predictionId);

    long countByUserIdAndRoleAndCreatedAtAfter(Long userId, String role, Instant after);

    long countByPredictionIdAndRole(Long predictionId, String role);
}
