package com.cropcare.disease;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class SourceRef {

    @Column(length = 300)
    private String title;

    @Column(length = 500)
    private String url;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
